package operation_setting

import "github.com/QuantumNous/new-api/setting/config"

// MiniGameSetting controls small games and quota rewards.
type MiniGameSetting struct {
	Enabled             bool `json:"enabled"`
	TetrisEnabled       bool `json:"tetris_enabled"`
	TetrisScorePerQuota int  `json:"tetris_score_per_quota"`
	DailyQuotaLimit     int  `json:"daily_quota_limit"`
}

var miniGameSetting = MiniGameSetting{
	Enabled:             false,
	TetrisEnabled:       true,
	TetrisScorePerQuota: 100,
	DailyQuotaLimit:     1000,
}

func init() {
	config.GlobalConfig.Register("mini_game_setting", &miniGameSetting)
}

func GetMiniGameSetting() *MiniGameSetting {
	return &miniGameSetting
}

func IsMiniGameEnabled() bool {
	return miniGameSetting.Enabled
}
