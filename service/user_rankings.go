package service

import (
	"math"
	"sort"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/model"
)

const (
	userRankingCacheTTL = 5 * time.Minute
	userRankingLimit    = 10
)

type UserRankingsResponse struct {
	Period          string              `json:"period"`
	Summary         UserRankingsSummary `json:"summary"`
	RequestRankings []RankedUser        `json:"request_rankings"`
	QuotaRankings   []RankedUser        `json:"quota_rankings"`
	TokenRankings   []RankedUser        `json:"token_rankings"`
}

type UserRankingsSummary struct {
	Requests        int64   `json:"requests"`
	Quota           int64   `json:"quota"`
	Tokens          int64   `json:"tokens"`
	Requests24H     int64   `json:"requests_24h"`
	Quota24H        int64   `json:"quota_24h"`
	Tokens24H       int64   `json:"tokens_24h"`
	RequestsAllTime int64   `json:"requests_all_time"`
	QuotaAllTime    int64   `json:"quota_all_time"`
	TokensAllTime   int64   `json:"tokens_all_time"`
	AverageRPM      float64 `json:"average_rpm"`
	AverageTPM      float64 `json:"average_tpm"`
}

type RankedUser struct {
	Rank     int     `json:"rank"`
	UserID   int     `json:"user_id"`
	Username string  `json:"username"`
	Value    int64   `json:"value"`
	Share    float64 `json:"share"`
}

type userRankingCacheItem struct {
	expiresAt time.Time
	data      *UserRankingsResponse
}

var (
	userRankingCacheMu sync.Mutex
	userRankingCache   = map[string]userRankingCacheItem{}
)

func GetUserRankingsSnapshot(period string) (*UserRankingsResponse, error) {
	config, err := rankingConfig(period)
	if err != nil {
		return nil, err
	}

	now := time.Now()
	userRankingCacheMu.Lock()
	if item, ok := userRankingCache[config.id]; ok && item.data != nil && now.Before(item.expiresAt) {
		data := item.data
		userRankingCacheMu.Unlock()
		return data, nil
	}
	userRankingCacheMu.Unlock()

	startTime, endTime := rankingTimeRange(config, now)
	rows, err := model.GetUserRankingAggregates(startTime, endTime)
	if err != nil {
		return nil, err
	}
	periodSummary, err := model.GetUserRankingSummary(startTime, endTime)
	if err != nil {
		return nil, err
	}

	dailySummary := periodSummary
	if config.id != "today" {
		dailySummary, err = model.GetUserRankingSummary(now.Add(-24*time.Hour).Unix(), endTime)
		if err != nil {
			return nil, err
		}
	}
	allTimeSummary := periodSummary
	if config.id != "all" {
		allTimeSummary, err = model.GetUserRankingSummary(0, endTime)
		if err != nil {
			return nil, err
		}
	}
	periodMinutes := userRankingPeriodMinutes(config, periodSummary, now)

	result := &UserRankingsResponse{
		Period: config.id,
		Summary: UserRankingsSummary{
			Requests:        periodSummary.RequestCount,
			Quota:           periodSummary.TotalQuota,
			Tokens:          periodSummary.TotalTokens,
			Requests24H:     dailySummary.RequestCount,
			Quota24H:        dailySummary.TotalQuota,
			Tokens24H:       dailySummary.TotalTokens,
			RequestsAllTime: allTimeSummary.RequestCount,
			QuotaAllTime:    allTimeSummary.TotalQuota,
			TokensAllTime:   allTimeSummary.TotalTokens,
			AverageRPM:      roundUserRankingRate(float64(periodSummary.RequestCount) / periodMinutes),
			AverageTPM:      roundUserRankingRate(float64(periodSummary.TotalTokens) / periodMinutes),
		},
		RequestRankings: buildRankedUsers(rows, periodSummary.RequestCount, func(row model.UserRankingAggregate) int64 { return row.RequestCount }),
		QuotaRankings:   buildRankedUsers(rows, periodSummary.TotalQuota, func(row model.UserRankingAggregate) int64 { return row.TotalQuota }),
		TokenRankings:   buildRankedUsers(rows, periodSummary.TotalTokens, func(row model.UserRankingAggregate) int64 { return row.TotalTokens }),
	}

	userRankingCacheMu.Lock()
	userRankingCache[config.id] = userRankingCacheItem{expiresAt: now.Add(userRankingCacheTTL), data: result}
	userRankingCacheMu.Unlock()
	return result, nil
}

func roundUserRankingRate(value float64) float64 {
	return math.Round(value*1_000_000) / 1_000_000
}

func userRankingPeriodMinutes(config rankingPeriodConfig, summary model.UserRankingSummary, now time.Time) float64 {
	if config.duration > 0 {
		return config.duration.Minutes()
	}
	if summary.FirstRequestAt <= 0 {
		return 1
	}
	minutes := now.Sub(time.Unix(summary.FirstRequestAt, 0)).Minutes()
	if minutes < 1 {
		return 1
	}
	return minutes
}

func buildRankedUsers(rows []model.UserRankingAggregate, total int64, valueOf func(model.UserRankingAggregate) int64) []RankedUser {
	sortedRows := append([]model.UserRankingAggregate(nil), rows...)
	sort.Slice(sortedRows, func(i, j int) bool {
		left := valueOf(sortedRows[i])
		right := valueOf(sortedRows[j])
		if left == right {
			return sortedRows[i].UserID < sortedRows[j].UserID
		}
		return left > right
	})

	limit := minInt(len(sortedRows), userRankingLimit)
	result := make([]RankedUser, 0, limit)
	for idx, row := range sortedRows[:limit] {
		value := valueOf(row)
		if value <= 0 {
			continue
		}
		result = append(result, RankedUser{
			Rank:     idx + 1,
			UserID:   row.UserID,
			Username: row.Username,
			Value:    value,
			Share:    rankingShare(value, total),
		})
	}
	return result
}
