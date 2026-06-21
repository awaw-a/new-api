package service

import (
	"testing"
	"time"

	"github.com/QuantumNous/new-api/model"
	"github.com/stretchr/testify/assert"
)

func TestUserRankingPeriodMinutes(t *testing.T) {
	now := time.Unix(10_000, 0)

	assert.Equal(t, float64(24*60), userRankingPeriodMinutes(
		rankingPeriodConfig{duration: 24 * time.Hour},
		model.UserRankingSummary{},
		now,
	))
	assert.Equal(t, float64(120), userRankingPeriodMinutes(
		rankingPeriodConfig{},
		model.UserRankingSummary{FirstRequestAt: now.Add(-2 * time.Hour).Unix()},
		now,
	))
	assert.Equal(t, float64(1), userRankingPeriodMinutes(
		rankingPeriodConfig{},
		model.UserRankingSummary{},
		now,
	))
}

func TestRoundUserRankingRatePreservesLowTrafficAverages(t *testing.T) {
	assert.Equal(t, 0.000029, roundUserRankingRate(1.0/35_000))
}
