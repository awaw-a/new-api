package service

import (
	"sort"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/model"
)

const (
	userRankingCacheTTL = 5 * time.Minute
	userRankingLimit    = 10
	userRankingMinutes  = 24 * 60
)

type UserRankingsResponse struct {
	Summary         UserRankingsSummary `json:"summary"`
	RequestRankings []RankedUser        `json:"request_rankings"`
	QuotaRankings   []RankedUser        `json:"quota_rankings"`
	TokenRankings   []RankedUser        `json:"token_rankings"`
}

type UserRankingsSummary struct {
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
	userRankingCache   userRankingCacheItem
)

func GetUserRankingsSnapshot() (*UserRankingsResponse, error) {
	now := time.Now()
	userRankingCacheMu.Lock()
	if userRankingCache.data != nil && now.Before(userRankingCache.expiresAt) {
		data := userRankingCache.data
		userRankingCacheMu.Unlock()
		return data, nil
	}
	userRankingCacheMu.Unlock()

	startTime := now.Add(-24 * time.Hour).Unix()
	endTime := now.Unix()
	rows, err := model.GetUserRankingAggregates(startTime, endTime)
	if err != nil {
		return nil, err
	}
	dailySummary, err := model.GetUserRankingSummary(startTime, endTime)
	if err != nil {
		return nil, err
	}
	allTimeSummary, err := model.GetUserRankingSummary(0, endTime)
	if err != nil {
		return nil, err
	}

	result := &UserRankingsResponse{
		Summary: UserRankingsSummary{
			Requests24H:     dailySummary.RequestCount,
			Quota24H:        dailySummary.TotalQuota,
			Tokens24H:       dailySummary.TotalTokens,
			RequestsAllTime: allTimeSummary.RequestCount,
			QuotaAllTime:    allTimeSummary.TotalQuota,
			TokensAllTime:   allTimeSummary.TotalTokens,
			AverageRPM:      roundRankingFloat(float64(dailySummary.RequestCount) / userRankingMinutes),
			AverageTPM:      roundRankingFloat(float64(dailySummary.TotalTokens) / userRankingMinutes),
		},
		RequestRankings: buildRankedUsers(rows, dailySummary.RequestCount, func(row model.UserRankingAggregate) int64 { return row.RequestCount }),
		QuotaRankings:   buildRankedUsers(rows, dailySummary.TotalQuota, func(row model.UserRankingAggregate) int64 { return row.TotalQuota }),
		TokenRankings:   buildRankedUsers(rows, dailySummary.TotalTokens, func(row model.UserRankingAggregate) int64 { return row.TotalTokens }),
	}

	userRankingCacheMu.Lock()
	userRankingCache = userRankingCacheItem{expiresAt: now.Add(userRankingCacheTTL), data: result}
	userRankingCacheMu.Unlock()
	return result, nil
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
