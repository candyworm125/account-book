import { useEffect, useRef, useState, useCallback } from 'react';
import { logger } from '@lark-apaas/client-toolkit-lite';

/**
 * 语音识别 Hook
 * 兼容 Web Speech API 和 iOS Safari 的 webkitSpeechRecognition
 *
 * 关键设计：
 * 1. continuous = true + interimResults = true，长句也能完整识别
 * 2. iOS Safari 会在静音/一次结果后自动触发 onend，通过「自动重启」实现无缝续听
 * 3. 用 isManuallyStoppedRef 区分「用户手动停止」和「引擎自动停止」
 * 4. final 结果累积拼接，避免重复/覆盖
 */
export function useSpeechRecognition() {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isSupported, setIsSupported] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<any>(null);
  /** 已确定的最终文本（累积所有 final 结果） */
  const finalTranscriptRef = useRef('');
  /** 是否用户手动停止（用于区分引擎自动停止） */
  const isManuallyStoppedRef = useRef(false);
  /** 自动重启的 timer，防止重复启动 */
  const restartTimerRef = useRef<number | null>(null);
  /** 本次会话是否已经产生过结果（用于过滤无意义的空重启） */
  const hasResultRef = useRef(false);

  useEffect(() => {
    // 检查浏览器支持
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setIsSupported(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'zh-CN';
    // 连续识别模式：允许多段结果持续返回
    recognition.continuous = true;
    // 返回临时结果，实时显示
    recognition.interimResults = true;
    // 允许返回替代结果（暂不需要，关掉减少数据量）
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: any) => {
      hasResultRef.current = true;

      let interim = '';
      // 从已累积的 final 文本开始
      let finalPiece = '';

      // resultIndex 表示本次事件新增结果的起始索引
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const text = result[0].transcript;
        if (result.isFinal) {
          finalPiece += text;
        } else {
          interim += text;
        }
      }

      // 只追加新增的 final 部分，避免重复拼接
      if (finalPiece) {
        finalTranscriptRef.current += finalPiece;
      }

      setTranscript(finalTranscriptRef.current + interim);
    };

    recognition.onerror = (event: any) => {
      const errCode = event.error;
      logger.error('语音识别错误:', errCode);

      // 以下错误属于「正常中断」，不抛错给用户，交给 onend 自动重启
      const benignErrors = ['no-speech', 'aborted', 'audio-capture'];
      if (benignErrors.includes(errCode)) {
        return;
      }

      // 真正的错误：权限拒绝 / 网络问题 / 不支持等
      setError(errCode);
      setIsListening(false);
      isManuallyStoppedRef.current = true;
      clearRestartTimer();
    };

    recognition.onend = () => {
      // 用户手动停止 → 真正结束
      if (isManuallyStoppedRef.current) {
        setIsListening(false);
        return;
      }

      // 引擎自动停止 → 自动重启，实现无缝续听
      // 加一个短暂延时，避免 start 调用过于频繁
      clearRestartTimer();
      restartTimerRef.current = window.setTimeout(() => {
        if (isManuallyStoppedRef.current) return;
        try {
          recognitionRef.current?.start();
        } catch (e) {
          // 重启失败，结束录音
          logger.error('语音识别自动重启失败:', String(e));
          setIsListening(false);
          isManuallyStoppedRef.current = true;
        }
      }, 150);
    };

    recognitionRef.current = recognition;

    return () => {
      isManuallyStoppedRef.current = true;
      clearRestartTimer();
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // ignore
        }
      }
    };
  }, []);

  const clearRestartTimer = () => {
    if (restartTimerRef.current !== null) {
      window.clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
  };

  const startListening = useCallback(() => {
    if (!recognitionRef.current) {
      setError('当前浏览器不支持语音识别');
      return;
    }

    // 重置状态
    setTranscript('');
    setError(null);
    finalTranscriptRef.current = '';
    isManuallyStoppedRef.current = false;
    hasResultRef.current = false;
    clearRestartTimer();

    try {
      recognitionRef.current.start();
      setIsListening(true);
    } catch (e) {
      // 可能已经在运行中（start 重复调用会抛 INVALID_STATE_ERR）
      // 这种情况不算错误，直接保证 isListening = true
      const errMsg = String(e);
      if (errMsg.includes('INVALID_STATE') || errMsg.includes('already started')) {
        setIsListening(true);
        return;
      }
      logger.error('启动语音识别失败:', errMsg);
      setError('启动失败，请重试');
    }
  }, []);

  const stopListening = useCallback(() => {
    if (!recognitionRef.current) return;

    isManuallyStoppedRef.current = true;
    clearRestartTimer();

    try {
      recognitionRef.current.stop();
    } catch {
      // 可能已经停了，忽略
    }

    // 立即更新 UI 状态（onend 里也会设，但手动停止立即响应用户操作）
    setIsListening(false);
  }, []);

  /** 获取最终的识别文本 */
  const getFinalTranscript = useCallback(() => {
    return finalTranscriptRef.current || transcript;
  }, [transcript]);

  return {
    isListening,
    transcript,
    isSupported,
    error,
    startListening,
    stopListening,
    getFinalTranscript,
  };
}
