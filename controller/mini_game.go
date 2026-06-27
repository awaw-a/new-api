package controller

import (
	"fmt"
	"net/http"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/gin-gonic/gin"
)

type MiniGameClaimRequest struct {
	SessionToken    string `json:"session_token"`
	Score           int    `json:"score"`
	DurationSeconds int    `json:"duration_seconds"`
}

func GetMiniGames(c *gin.Context) {
	userId := c.GetInt("id")
	setting := operation_setting.GetMiniGameSetting()
	today := time.Now().Format("2006-01-02")

	stats, err := model.GetUserMiniGameDailyStats(userId, today)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	recentPlays, err := model.GetUserMiniGameRecentPlays(userId, 8)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	tetrisBestRecord, err := model.GetUserMiniGameBestRecord(userId, model.MiniGameKeyTetris)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	tetrisLeaderboard, err := model.GetMiniGameLeaderboard(model.MiniGameKeyTetris, 10)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	dailyLimit := setting.DailyQuotaLimit
	dailyRemaining := dailyLimit - int(stats.QuotaAwarded)
	if dailyRemaining < 0 {
		dailyRemaining = 0
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"enabled":         setting.Enabled,
			"daily_limit":     dailyLimit,
			"daily_earned":    stats.QuotaAwarded,
			"daily_remaining": dailyRemaining,
			"play_count":      stats.PlayCount,
			"tetris_stats": gin.H{
				"best_record": tetrisBestRecord,
				"leaderboard": tetrisLeaderboard,
			},
			"games": []gin.H{
				{
					"key":             model.MiniGameKeyTetris,
					"name":            "俄罗斯方块",
					"enabled":         setting.Enabled && setting.TetrisEnabled,
					"quota_per_score": setting.TetrisQuotaPerScore,
				},
			},
			"recent_plays": recentPlays,
		},
	})
}

func StartTetrisGame(c *gin.Context) {
	userId := c.GetInt("id")
	session, err := model.StartMiniGameSession(userId, model.MiniGameKeyTetris)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"session_token": session.SessionToken,
			"started_at":    session.StartedAt,
		},
	})
}

func ClaimTetrisReward(c *gin.Context) {
	var req MiniGameClaimRequest
	if err := common.DecodeJson(c.Request.Body, &req); err != nil {
		common.ApiErrorMsg(c, "无效的参数")
		return
	}

	userId := c.GetInt("id")
	play, stats, err := model.ClaimMiniGameReward(
		userId,
		model.MiniGameKeyTetris,
		req.SessionToken,
		req.Score,
		req.DurationSeconds,
	)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}

	userQuota, quotaErr := model.GetUserQuota(userId, true)
	if quotaErr != nil {
		common.SysLog("failed to get user quota after mini game reward: " + quotaErr.Error())
	}

	setting := operation_setting.GetMiniGameSetting()
	dailyRemaining := setting.DailyQuotaLimit - int(stats.QuotaAwarded)
	if dailyRemaining < 0 {
		dailyRemaining = 0
	}

	model.RecordLog(
		userId,
		model.LogTypeSystem,
		fmt.Sprintf(
			"俄罗斯方块得分 %d，获得额度 %s",
			play.Score,
			logger.LogQuota(play.QuotaAwarded),
		),
	)

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "领取成功",
		"data": gin.H{
			"score":           play.Score,
			"quota_awarded":   play.QuotaAwarded,
			"daily_earned":    stats.QuotaAwarded,
			"daily_remaining": dailyRemaining,
			"user_quota":      userQuota,
		},
	})
}
