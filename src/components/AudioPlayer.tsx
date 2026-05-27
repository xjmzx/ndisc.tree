import { useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import { cn } from "../lib/cn";

/**
 * Minimal in-house audio player. We replace the native `<audio controls>`
 * because WebKit2GTK doesn't honour `controlsList="noplaybackrate"` and
 * doesn't expose its media-controls shadow DOM to CSS — neither of the
 * two things we wanted to do (drop the speed control + match the panel
 * background) could land via the native widget.
 *
 * Surface: play/pause toggle, click-to-seek progress bar, current /
 * duration readout. Volume defers to the system mixer; track length is
 * ~10 s for samples so the missing volume slider isn't material.
 */

interface AudioPlayerProps {
  src: string;
  className?: string;
}

function formatTime(s: number): string {
  if (!isFinite(s) || s < 0) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

export function AudioPlayer({ src, className }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onTime = () => setCurrentTime(audio.currentTime);
    const onMeta = () => setDuration(audio.duration);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onEnd = () => {
      setPlaying(false);
      audio.currentTime = 0;
      setCurrentTime(0);
    };
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onMeta);
    audio.addEventListener("durationchange", onMeta);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("ended", onEnd);
    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", onMeta);
      audio.removeEventListener("durationchange", onMeta);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("ended", onEnd);
    };
  }, [src]);

  function toggle() {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      audio.play().catch(() => {
        /* autoplay or fetch failure — surface in console only */
      });
    } else {
      audio.pause();
    }
  }

  function seek(e: React.MouseEvent<HTMLDivElement>) {
    const audio = audioRef.current;
    if (!audio || !duration || !isFinite(duration)) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    audio.currentTime = pct * duration;
    setCurrentTime(audio.currentTime);
  }

  const pct = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div
      className={cn(
        "flex items-center gap-2 px-2 py-1 rounded bg-bg/40",
        className,
      )}
    >
      <audio ref={audioRef} src={src} preload="none" />
      <button
        onClick={toggle}
        className="text-fg/90 hover:text-accent shrink-0 transition-colors"
        title={playing ? "Pause" : "Play"}
        aria-label={playing ? "Pause" : "Play"}
      >
        {playing ? <Pause size={14} /> : <Play size={14} />}
      </button>
      <div
        onClick={seek}
        className="flex-1 h-1 rounded-full bg-surface/60 overflow-hidden cursor-pointer relative min-w-0"
        title="Click to seek"
      >
        <div
          className="h-full bg-accent transition-[width] duration-75"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[10px] text-muted font-mono tabular-nums shrink-0">
        {formatTime(currentTime)} / {formatTime(duration)}
      </span>
    </div>
  );
}
