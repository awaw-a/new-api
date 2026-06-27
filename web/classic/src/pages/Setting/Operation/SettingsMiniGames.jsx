/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/

import React, { useEffect, useRef, useState } from 'react';
import { Button, Col, Form, Row, Spin, Typography } from '@douyinfe/semi-ui';
import {
  API,
  compareObjects,
  renderQuota,
  showError,
  showSuccess,
  showWarning,
} from '../../../helpers';
import { useTranslation } from 'react-i18next';

export default function SettingsMiniGames(props) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [inputs, setInputs] = useState({
    'mini_game_setting.enabled': false,
    'mini_game_setting.tetris_enabled': true,
    'mini_game_setting.tetris_quota_per_score': 1,
    'mini_game_setting.daily_quota_limit': 1000,
  });
  const [inputsRow, setInputsRow] = useState(inputs);
  const refForm = useRef();

  function handleFieldChange(fieldName) {
    return (value) => {
      setInputs((inputs) => ({ ...inputs, [fieldName]: value }));
    };
  }

  function onSubmit() {
    const updateArray = compareObjects(inputs, inputsRow);
    if (!updateArray.length) return showWarning(t('你似乎并没有修改什么'));
    const requestQueue = updateArray.map((item) =>
      API.put('/api/option/', {
        key: item.key,
        value: String(inputs[item.key]),
      }),
    );
    setLoading(true);
    Promise.all(requestQueue)
      .then((res) => {
        if (res.includes(undefined)) {
          return showError(t('部分保存失败，请重试'));
        }
        showSuccess(t('保存成功'));
        props.refresh();
      })
      .catch(() => {
        showError(t('保存失败，请重试'));
      })
      .finally(() => {
        setLoading(false);
      });
  }

  useEffect(() => {
    const currentInputs = {};
    for (let key in props.options) {
      if (Object.keys(inputs).includes(key)) {
        currentInputs[key] = props.options[key];
      }
    }
    setInputs(currentInputs);
    setInputsRow(structuredClone(currentInputs));
    refForm.current?.setValues(currentInputs);
  }, [props.options]);

  return (
    <Spin spinning={loading}>
      <Form
        values={inputs}
        getFormApi={(formAPI) => (refForm.current = formAPI)}
        style={{ marginBottom: 15 }}
      >
        <Form.Section text={t('小游戏设置')}>
          <Typography.Text
            type='tertiary'
            style={{ marginBottom: 16, display: 'block' }}
          >
            {t('配置用户通过小游戏获得额度的规则')}
          </Typography.Text>
          <Row gutter={16}>
            <Col xs={24} sm={12} md={6} lg={6} xl={6}>
              <Form.Switch
                field='mini_game_setting.enabled'
                label={t('启用小游戏功能')}
                size='default'
                checkedText='｜'
                uncheckedText='〇'
                onChange={handleFieldChange('mini_game_setting.enabled')}
              />
            </Col>
            <Col xs={24} sm={12} md={6} lg={6} xl={6}>
              <Form.Switch
                field='mini_game_setting.tetris_enabled'
                label={t('启用俄罗斯方块')}
                size='default'
                checkedText='｜'
                uncheckedText='〇'
                disabled={!inputs['mini_game_setting.enabled']}
                onChange={handleFieldChange('mini_game_setting.tetris_enabled')}
              />
            </Col>
            <Col xs={24} sm={12} md={6} lg={6} xl={6}>
              <Form.InputNumber
                field='mini_game_setting.tetris_quota_per_score'
                label={t('每分数对应额度')}
                placeholder={t('例如：1')}
                min={0.000001}
                step={0.01}
                disabled={!inputs['mini_game_setting.enabled']}
                onChange={handleFieldChange(
                  'mini_game_setting.tetris_quota_per_score',
                )}
              />
            </Col>
            <Col xs={24} sm={12} md={6} lg={6} xl={6}>
              <Form.InputNumber
                field='mini_game_setting.daily_quota_limit'
                label={t('每日最大获取额度')}
                placeholder={t('每日最多奖励额度')}
                min={0}
                disabled={!inputs['mini_game_setting.enabled']}
                onChange={handleFieldChange(
                  'mini_game_setting.daily_quota_limit',
                )}
              />
            </Col>
          </Row>
          <Typography.Text
            type='tertiary'
            size='small'
            style={{ display: 'block', marginBottom: 16 }}
          >
            {t('当前每日上限约为')}
            {renderQuota(inputs['mini_game_setting.daily_quota_limit'] || 0)}
          </Typography.Text>
          <Row>
            <Button size='default' onClick={onSubmit}>
              {t('保存小游戏设置')}
            </Button>
          </Row>
        </Form.Section>
      </Form>
    </Spin>
  );
}
