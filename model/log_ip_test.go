package model

import (
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestRequestLogsAlwaysRecordClientIP(t *testing.T) {
	truncateTables(t)
	require.NoError(t, DB.Exec("DELETE FROM logs").Error)

	context, _ := gin.CreateTestContext(httptest.NewRecorder())
	context.Request = httptest.NewRequest("POST", "/v1/chat/completions", nil)
	context.Request.RemoteAddr = "203.0.113.42:54321"
	context.Set("username", "alice")
	context.Set(common.RequestIdKey, "request-ip-test")

	RecordConsumeLog(context, 1, RecordConsumeLogParams{
		ModelName:        "test-model",
		PromptTokens:     10,
		CompletionTokens: 5,
		Quota:            100,
	})
	RecordErrorLog(context, 1, 2, "test-model", "default", "upstream error", 3, 1, false, "default", nil)

	var logs []Log
	require.NoError(t, LOG_DB.Order("id asc").Find(&logs).Error)
	require.Len(t, logs, 2)
	assert.Equal(t, "203.0.113.42", logs[0].Ip)
	assert.Equal(t, "203.0.113.42", logs[1].Ip)
}
