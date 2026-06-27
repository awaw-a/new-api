package model

import (
	"errors"
	"fmt"
	"math"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"gorm.io/gorm"
)

const MiniGameKeyTetris = "tetris"

type MiniGamePlay struct {
	Id              int    `json:"id" gorm:"primaryKey;autoIncrement"`
	UserId          int    `json:"user_id" gorm:"not null;index:idx_mini_game_user_date"`
	GameKey         string `json:"game_key" gorm:"type:varchar(32);not null;index:idx_mini_game_user_date"`
	PlayDate        string `json:"play_date" gorm:"type:varchar(10);not null;index:idx_mini_game_user_date"`
	Score           int    `json:"score" gorm:"not null;default:0"`
	DurationSeconds int    `json:"duration_seconds" gorm:"not null;default:0"`
	QuotaAwarded    int    `json:"quota_awarded" gorm:"not null;default:0"`
	CreatedAt       int64  `json:"created_at" gorm:"bigint;index"`
}

type MiniGameSession struct {
	Id              int    `json:"id" gorm:"primaryKey;autoIncrement"`
	UserId          int    `json:"user_id" gorm:"not null;index"`
	GameKey         string `json:"game_key" gorm:"type:varchar(32);not null;index"`
	SessionToken    string `json:"session_token" gorm:"type:varchar(64);not null;uniqueIndex"`
	StartedAt       int64  `json:"started_at" gorm:"bigint;not null;index"`
	FinishedAt      int64  `json:"finished_at" gorm:"bigint;default:0"`
	DurationSeconds int    `json:"duration_seconds" gorm:"not null;default:0"`
	Claimed         bool   `json:"claimed" gorm:"not null;default:false;index"`
}

func (MiniGamePlay) TableName() string {
	return "mini_game_plays"
}

func (MiniGameSession) TableName() string {
	return "mini_game_sessions"
}

type MiniGameDailyStats struct {
	QuotaAwarded int64 `json:"quota_awarded"`
	PlayCount    int64 `json:"play_count"`
}

type MiniGameBestRecord struct {
	UserId          int    `json:"user_id" gorm:"column:user_id"`
	Username        string `json:"username" gorm:"column:username"`
	Score           int    `json:"score" gorm:"column:score"`
	DurationSeconds int    `json:"duration_seconds" gorm:"column:duration_seconds"`
	QuotaAwarded    int    `json:"quota_awarded" gorm:"column:quota_awarded"`
	CreatedAt       int64  `json:"created_at" gorm:"column:created_at"`
	PlayCount       int64  `json:"play_count" gorm:"column:play_count"`
}

type miniGameBestScoreAggregate struct {
	UserId    int   `gorm:"column:user_id"`
	Score     int   `gorm:"column:score"`
	PlayCount int64 `gorm:"column:play_count"`
}

func todayMiniGameDate() string {
	return time.Now().Format("2006-01-02")
}

func GetUserMiniGameDailyStats(userId int, playDate string) (MiniGameDailyStats, error) {
	if playDate == "" {
		playDate = todayMiniGameDate()
	}
	var stats MiniGameDailyStats
	err := DB.Model(&MiniGamePlay{}).
		Select("COALESCE(SUM(quota_awarded), 0) AS quota_awarded, COUNT(*) AS play_count").
		Where("user_id = ? AND play_date = ?", userId, playDate).
		Scan(&stats).Error
	return stats, err
}

func GetUserMiniGameRecentPlays(userId int, limit int) ([]MiniGamePlay, error) {
	if limit <= 0 {
		limit = 10
	}
	var plays []MiniGamePlay
	err := DB.Where("user_id = ?", userId).
		Order("id DESC").
		Limit(limit).
		Find(&plays).Error
	return plays, err
}

func GetUserMiniGameBestRecord(userId int, gameKey string) (MiniGameBestRecord, error) {
	var playCount int64
	if err := DB.Model(&MiniGamePlay{}).
		Where("user_id = ? AND game_key = ?", userId, gameKey).
		Count(&playCount).Error; err != nil {
		return MiniGameBestRecord{}, err
	}
	if playCount == 0 {
		return MiniGameBestRecord{UserId: userId}, nil
	}

	var play MiniGamePlay
	if err := DB.Where("user_id = ? AND game_key = ?", userId, gameKey).
		Order("score DESC, id ASC").
		First(&play).Error; err != nil {
		return MiniGameBestRecord{}, err
	}
	return miniGameBestRecordFromPlay(play, playCount)
}

func GetMiniGameLeaderboard(gameKey string, limit int) ([]MiniGameBestRecord, error) {
	if limit <= 0 {
		limit = 10
	}

	var aggregates []miniGameBestScoreAggregate
	if err := DB.Model(&MiniGamePlay{}).
		Select("user_id, MAX(score) AS score, COUNT(*) AS play_count").
		Where("game_key = ?", gameKey).
		Group("user_id").
		Order("score DESC, user_id ASC").
		Limit(limit).
		Scan(&aggregates).Error; err != nil {
		return nil, err
	}

	records := make([]MiniGameBestRecord, 0, len(aggregates))
	for _, aggregate := range aggregates {
		var play MiniGamePlay
		if err := DB.Where("user_id = ? AND game_key = ? AND score = ?", aggregate.UserId, gameKey, aggregate.Score).
			Order("id ASC").
			First(&play).Error; err != nil {
			return nil, err
		}

		record, err := miniGameBestRecordFromPlay(play, aggregate.PlayCount)
		if err != nil {
			return nil, err
		}
		records = append(records, record)
	}
	return records, nil
}

func miniGameBestRecordFromPlay(play MiniGamePlay, playCount int64) (MiniGameBestRecord, error) {
	record := MiniGameBestRecord{
		UserId:          play.UserId,
		Score:           play.Score,
		DurationSeconds: play.DurationSeconds,
		QuotaAwarded:    play.QuotaAwarded,
		CreatedAt:       play.CreatedAt,
		PlayCount:       playCount,
	}

	var user User
	err := DB.Select("username", "display_name").Where("id = ?", play.UserId).First(&user).Error
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return MiniGameBestRecord{}, err
	}
	if user.DisplayName != "" {
		record.Username = user.DisplayName
	} else if user.Username != "" {
		record.Username = user.Username
	} else {
		record.Username = fmt.Sprintf("User #%d", play.UserId)
	}
	return record, nil
}

func validateMiniGameAvailable(gameKey string) error {
	setting := operation_setting.GetMiniGameSetting()
	if !setting.Enabled {
		return errors.New("小游戏功能未启用")
	}
	if gameKey != MiniGameKeyTetris {
		return errors.New("不支持的小游戏")
	}
	if !setting.TetrisEnabled {
		return errors.New("俄罗斯方块暂未开放")
	}
	return nil
}

func StartMiniGameSession(userId int, gameKey string) (*MiniGameSession, error) {
	if err := validateMiniGameAvailable(gameKey); err != nil {
		return nil, err
	}

	session := &MiniGameSession{
		UserId:       userId,
		GameKey:      gameKey,
		SessionToken: common.GetUUID(),
		StartedAt:    common.GetTimestamp(),
		Claimed:      false,
	}
	if err := DB.Create(session).Error; err != nil {
		return nil, err
	}
	return session, nil
}

func ClaimMiniGameReward(userId int, gameKey string, sessionToken string, score int, clientDurationSeconds int) (*MiniGamePlay, MiniGameDailyStats, error) {
	if err := validateMiniGameAvailable(gameKey); err != nil {
		return nil, MiniGameDailyStats{}, err
	}

	setting := operation_setting.GetMiniGameSetting()
	if setting.TetrisQuotaPerScore <= 0 {
		return nil, MiniGameDailyStats{}, errors.New("小游戏奖励比例配置无效")
	}
	if setting.DailyQuotaLimit <= 0 {
		return nil, MiniGameDailyStats{}, errors.New("小游戏每日奖励上限配置无效")
	}
	if score <= 0 {
		return nil, MiniGameDailyStats{}, errors.New("游戏分数无效")
	}
	if sessionToken == "" {
		return nil, MiniGameDailyStats{}, errors.New("游戏局次无效")
	}
	if clientDurationSeconds < 0 {
		clientDurationSeconds = 0
	}

	playDate := todayMiniGameDate()
	quotaByScore := int(math.Floor(float64(score) * setting.TetrisQuotaPerScore))
	if quotaByScore <= 0 {
		return nil, MiniGameDailyStats{}, errors.New("本局分数不足，暂无法领取额度")
	}

	var play MiniGamePlay
	var stats MiniGameDailyStats
	err := DB.Transaction(func(tx *gorm.DB) error {
		var session MiniGameSession
		if err := tx.Where(
			"user_id = ? AND game_key = ? AND session_token = ?",
			userId,
			gameKey,
			sessionToken,
		).First(&session).Error; err != nil {
			return errors.New("游戏局次无效或已过期")
		}
		if session.Claimed {
			return errors.New("本局游戏已结算")
		}

		now := common.GetTimestamp()
		serverDurationSeconds := int(now - session.StartedAt)
		if serverDurationSeconds < 0 {
			serverDurationSeconds = 0
		}

		if err := tx.Model(&MiniGamePlay{}).
			Select("COALESCE(SUM(quota_awarded), 0) AS quota_awarded, COUNT(*) AS play_count").
			Where("user_id = ? AND play_date = ?", userId, playDate).
			Scan(&stats).Error; err != nil {
			return err
		}

		remaining := int64(setting.DailyQuotaLimit) - stats.QuotaAwarded
		if remaining <= 0 {
			return errors.New("今日小游戏额度已达上限")
		}

		quotaAwarded := quotaByScore
		if int64(quotaAwarded) > remaining {
			quotaAwarded = int(remaining)
		}

		play = MiniGamePlay{
			UserId:          userId,
			GameKey:         gameKey,
			PlayDate:        playDate,
			Score:           score,
			DurationSeconds: serverDurationSeconds,
			QuotaAwarded:    quotaAwarded,
			CreatedAt:       common.GetTimestamp(),
		}
		updateResult := tx.Model(&MiniGameSession{}).
			Where("id = ? AND claimed = ?", session.Id, false).
			Updates(map[string]interface{}{
				"claimed":          true,
				"finished_at":      now,
				"duration_seconds": serverDurationSeconds,
			})
		if updateResult.Error != nil {
			return updateResult.Error
		}
		if updateResult.RowsAffected == 0 {
			return errors.New("本局游戏已结算")
		}
		if err := tx.Create(&play).Error; err != nil {
			return err
		}
		if err := tx.Model(&User{}).Where("id = ?", userId).
			Update("quota", gorm.Expr("quota + ?", quotaAwarded)).Error; err != nil {
			return err
		}

		stats.QuotaAwarded += int64(quotaAwarded)
		stats.PlayCount++
		return nil
	})
	if err != nil {
		return nil, stats, err
	}

	if play.QuotaAwarded > 0 {
		go func() {
			if err := cacheIncrUserQuota(userId, int64(play.QuotaAwarded)); err != nil {
				common.SysLog("failed to increase user quota cache after mini game reward: " + err.Error())
			}
		}()
	}

	return &play, stats, nil
}
