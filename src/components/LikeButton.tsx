"use client";

import { useEffect, useState } from "react";
import { getClientId } from "@/lib/client-id";

interface LikeButtonProps {
  questionId: number;
  likeCount: number;
  likedByClient: boolean;
}

export function LikeButton({ questionId, likeCount, likedByClient }: LikeButtonProps) {
  const [liked, setLiked] = useState(likedByClient);
  const [count, setCount] = useState(likeCount);
  const [loading, setLoading] = useState(false);

  // ポーリングで更新された値をサーバーの最新状態で同期（操作中は無視）
  useEffect(() => {
    if (!loading) {
      setLiked(likedByClient);
      setCount(likeCount);
    }
  }, [likeCount, likedByClient, loading]);

  const toggle = async () => {
    if (loading) return;
    setLoading(true);
    const clientId = getClientId();
    // 楽観的更新
    const wasLiked = liked;
    setLiked(!wasLiked);
    setCount((c) => (wasLiked ? c - 1 : c + 1));
    try {
      await fetch(`/api/questions/${questionId}/like`, {
        method: wasLiked ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId }),
      });
    } catch {
      // 失敗時はロールバック
      setLiked(wasLiked);
      setCount((c) => (wasLiked ? c + 1 : c - 1));
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={toggle}
      disabled={loading}
      className={`flex items-center gap-1 text-sm px-3 py-1.5 rounded-full transition-colors ${
        liked
          ? "bg-red-100 text-red-600 border border-red-200"
          : "bg-gray-100 text-gray-600 border border-gray-200 hover:bg-red-50 hover:text-red-500"
      }`}
    >
      <span>{liked ? "♥" : "♡"}</span>
      <span>{count}</span>
    </button>
  );
}
