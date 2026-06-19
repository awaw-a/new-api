package model

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestUserRankingQueriesAggregateConsumeLogsByUser(t *testing.T) {
	truncateTables(t)
	require.NoError(t, DB.Exec("DELETE FROM logs").Error)

	now := time.Now().Unix()
	logs := []Log{
		{UserId: 1, Username: "alice", CreatedAt: now - 60, Type: LogTypeConsume, Quota: 100, PromptTokens: 10, CompletionTokens: 20},
		{UserId: 1, Username: "alice", CreatedAt: now - 120, Type: LogTypeConsume, Quota: 200, PromptTokens: 30, CompletionTokens: 40},
		{UserId: 2, Username: "bob", CreatedAt: now - 180, Type: LogTypeConsume, Quota: 90, PromptTokens: 5, CompletionTokens: 15},
		{UserId: 1, Username: "alice", CreatedAt: now - 48*3600, Type: LogTypeConsume, Quota: 999, PromptTokens: 1, CompletionTokens: 1},
		{UserId: 1, Username: "alice", CreatedAt: now - 30, Type: LogTypeError, Quota: 500, PromptTokens: 50, CompletionTokens: 50},
		{UserId: 0, Username: "system", CreatedAt: now - 30, Type: LogTypeConsume, Quota: 500, PromptTokens: 50, CompletionTokens: 50},
	}
	require.NoError(t, LOG_DB.Create(&logs).Error)

	rows, err := GetUserRankingAggregates(now-24*3600, now+1)
	require.NoError(t, err)
	require.Len(t, rows, 2)

	byUserID := make(map[int]UserRankingAggregate, len(rows))
	for _, row := range rows {
		byUserID[row.UserID] = row
	}
	assert.Equal(t, UserRankingAggregate{UserID: 1, Username: "alice", RequestCount: 2, TotalQuota: 300, TotalTokens: 100}, byUserID[1])
	assert.Equal(t, UserRankingAggregate{UserID: 2, Username: "bob", RequestCount: 1, TotalQuota: 90, TotalTokens: 20}, byUserID[2])

	daily, err := GetUserRankingSummary(now-24*3600, now+1)
	require.NoError(t, err)
	assert.Equal(t, UserRankingSummary{RequestCount: 3, TotalQuota: 390, TotalTokens: 120}, daily)

	allTime, err := GetUserRankingSummary(0, now+1)
	require.NoError(t, err)
	assert.Equal(t, UserRankingSummary{RequestCount: 4, TotalQuota: 1389, TotalTokens: 122}, allTime)
}
