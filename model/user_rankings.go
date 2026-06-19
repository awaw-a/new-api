package model

import "gorm.io/gorm"

type UserRankingAggregate struct {
	UserID       int    `json:"user_id" gorm:"column:user_id"`
	Username     string `json:"username" gorm:"column:username"`
	RequestCount int64  `json:"request_count" gorm:"column:request_count"`
	TotalQuota   int64  `json:"total_quota" gorm:"column:total_quota"`
	TotalTokens  int64  `json:"total_tokens" gorm:"column:total_tokens"`
}

type UserRankingSummary struct {
	RequestCount int64 `json:"request_count" gorm:"column:request_count"`
	TotalQuota   int64 `json:"total_quota" gorm:"column:total_quota"`
	TotalTokens  int64 `json:"total_tokens" gorm:"column:total_tokens"`
}

func GetUserRankingAggregates(startTime int64, endTime int64) ([]UserRankingAggregate, error) {
	var rows []UserRankingAggregate
	query := applyUserRankingTimeRange(userRankingConsumeQuery(), startTime, endTime).
		Select(`user_id,
			MAX(username) AS username,
			COUNT(*) AS request_count,
			COALESCE(SUM(quota), 0) AS total_quota,
			COALESCE(SUM(prompt_tokens), 0) + COALESCE(SUM(completion_tokens), 0) AS total_tokens`).
		Group("user_id")
	err := query.Scan(&rows).Error
	return rows, err
}

func GetUserRankingSummary(startTime int64, endTime int64) (UserRankingSummary, error) {
	var summary UserRankingSummary
	query := applyUserRankingTimeRange(userRankingConsumeQuery(), startTime, endTime).
		Select(`COUNT(*) AS request_count,
			COALESCE(SUM(quota), 0) AS total_quota,
			COALESCE(SUM(prompt_tokens), 0) + COALESCE(SUM(completion_tokens), 0) AS total_tokens`)
	err := query.Scan(&summary).Error
	return summary, err
}

func userRankingConsumeQuery() *gorm.DB {
	return LOG_DB.Model(&Log{}).
		Where("type = ?", LogTypeConsume).
		Where("user_id > 0")
}

func applyUserRankingTimeRange(query *gorm.DB, startTime int64, endTime int64) *gorm.DB {
	if startTime > 0 {
		query = query.Where("created_at >= ?", startTime)
	}
	if endTime > 0 {
		query = query.Where("created_at <= ?", endTime)
	}
	return query
}
