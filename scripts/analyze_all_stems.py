import os
import glob
import json
import numpy as np
import librosa
import soundfile as sf

def analyze_full_song(song_dir):
    song_name = os.path.basename(song_dir)
    print(f"\n==========================================")
    print(f"DEEP LIBROSA ANALYSIS: {song_name}")
    print(f"==========================================")

    # ピアノトラックとドラムトラックを見つける
    files = glob.glob(os.path.join(song_dir, "*.mp3"))
    drums_f = next((f for f in files if "drum" in os.path.basename(f).lower()), None)
    piano_f = next((f for f in files if "piano" in os.path.basename(f).lower()), None)
    other_f = next((f for f in files if "other" in os.path.basename(f).lower()), None)
    vocal_f = next((f for f in files if "vocal" in os.path.basename(f).lower()), None)
    
    # イントロから音があるトラック（ピアノ優先、なければボーカル、なければ最初）
    lead_f = piano_f or vocal_f or files[0]
    print(f"Lead instrument for intro: {os.path.basename(lead_f)}")
    if drums_f:
        print(f"Rhythm instrument for beats: {os.path.basename(drums_f)}")
        
    # 音声を読み込む
    y_lead, sr = librosa.load(lead_f, sr=22050)
    duration = librosa.get_duration(y=y_lead, sr=sr)
    
    # ドラムがある場合はミックスして解析用オーディオを作る
    if drums_f and drums_f != lead_f:
        y_drums, _ = librosa.load(drums_f, sr=sr)
        min_len = min(len(y_lead), len(y_drums))
        y_mix = y_lead[:min_len] + y_drums[:min_len] * 1.5
    else:
        y_mix = y_lead

    # 1. Onset strength envelope
    onset_env = librosa.onset.onset_strength(y=y_mix, sr=sr, aggregate=np.median)
    
    # 2. Global Tempo detection (Fourier Tempogram)
    tempo = librosa.feature.tempo(onset_envelope=onset_env, sr=sr)
    detected_bpm = float(tempo[0]) if hasattr(tempo, '__len__') else float(tempo)
    print(f"Detected BPM: {detected_bpm:.2f}")

    # 3. Dynamic beat tracking with tightness
    tempo_track, beat_frames = librosa.beat.beat_track(
        y=y_mix, sr=sr, onset_envelope=onset_env, trim=False, tightness=100
    )
    beat_times = librosa.frames_to_time(beat_frames, sr=sr).tolist()
    
    # 4. Check intervals
    diffs = np.diff(beat_times)
    median_ibi = float(np.median(diffs))
    bpm_from_ibi = 60.0 / median_ibi
    print(f"LibROSA Dynamic Beat Markers: {len(beat_times)} beats")
    print(f"Median interval: {median_ibi:.4f}s -> Calculated BPM: {bpm_from_ibi:.2f}")

    # 5. First beat and downbeat identification
    # ドラムが入る位置、または最初の強いオンセット
    if drums_f:
        y_d, _ = librosa.load(drums_f, sr=sr)
        onset_env_d = librosa.onset.onset_strength(y=y_d, sr=sr)
        drums_onsets = librosa.onset.onset_detect(y=y_d, sr=sr, onset_envelope=onset_env_d, units='time')
        # 最初の本打ち（最大エネルギーの20%以上）
        thresh = np.max(onset_env_d) * 0.2
        strong_drums_onsets = [t for t in drums_onsets if onset_env_d[librosa.time_to_frames(t, sr=sr)] > thresh]
        first_drum_hit = strong_drums_onsets[0] if strong_drums_onsets else None
    else:
        first_drum_hit = None

    print(f"First 8 beat times: {[round(t, 3) for t in beat_times[:8]]}")
    if first_drum_hit:
        print(f"First strong drum hit (Drop/Main Beat): {first_drum_hit:.3f}s")
        # first_drum_hit に一番近い beat_marker を見つける
        closest_beat = min(beat_times, key=lambda t: abs(t - first_drum_hit))
        closest_beat_idx = beat_times.index(closest_beat)
        print(f"Closest beat to drum hit: beat index {closest_beat_idx} at {closest_beat:.3f}s")
    else:
        closest_beat = beat_times[0] if beat_times else 0.0
        closest_beat_idx = 0

    return {
        "title": song_name,
        "duration": duration,
        "bpm": round(bpm_from_ibi, 2),
        "global_bpm": round(detected_bpm, 2),
        "median_ibi": round(median_ibi, 4),
        "first_beat": round(beat_times[0], 4) if beat_times else 0.0,
        "first_drum_hit": round(first_drum_hit, 4) if first_drum_hit else None,
        "downbeat_beat_index": closest_beat_idx,
        "downbeat_time": round(closest_beat, 4),
        "beat_times": [round(t, 4) for t in beat_times]
    }

dirs = sorted(glob.glob("public/stems/*"))
results = {}
for d in dirs:
    if os.path.isdir(d):
        res = analyze_full_song(d)
        results[os.path.basename(d)] = res

with open("scripts/librosa_detailed_analysis.json", "w", encoding="utf-8") as f:
    json.dump(results, f, indent=2, ensure_ascii=False)

print("\nDetailed LibROSA analysis completed and saved to scripts/librosa_detailed_analysis.json")
