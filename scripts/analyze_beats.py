import os
import glob
import json
import numpy as np
import librosa
import soundfile as sf

def analyze_song(song_dir):
    print(f"\n==========================================")
    print(f"ANALYZING: {os.path.basename(song_dir)}")
    print(f"==========================================")
    
    # ステムファイルを探す（ドラム優先、なければベース、なければピアノ、なければ最初に見つかったもの）
    files = glob.glob(os.path.join(song_dir, "*.mp3"))
    drums_file = None
    bass_file = None
    other_file = None
    
    for f in files:
        fname = os.path.basename(f).lower()
        if "drum" in fname:
            drums_file = f
        elif "bass" in fname:
            bass_file = f
        else:
            other_file = f
            
    target_file = drums_file or bass_file or other_file
    print(f"Primary audio source for beat detection: {os.path.basename(target_file)}")
    
    # Load audio
    y, sr = librosa.load(target_file, sr=22050)
    duration = librosa.get_duration(y=y, sr=sr)
    print(f"Duration: {duration:.2f}s, Sample Rate: {sr}")
    
    # 1. Onset envelope
    onset_env = librosa.onset.onset_strength(y=y, sr=sr)
    
    # 2. Prior BPM estimate (Fourier tempogram)
    prior = librosa.feature.tempo(onset_envelope=onset_env, sr=sr)
    detected_bpm = float(prior[0]) if hasattr(prior, '__len__') else float(prior)
    print(f"LibROSA detected global tempo: {detected_bpm:.2f} BPM")
    
    # 3. Dynamic beat tracking with LibROSA
    tempo, beat_frames = librosa.beat.beat_track(
        y=y, sr=sr, onset_envelope=onset_env, trim=False, units='frames'
    )
    beat_times = librosa.frames_to_time(beat_frames, sr=sr).tolist()
    
    print(f"Detected {len(beat_times)} beat markers.")
    if len(beat_times) > 0:
        print(f"First 8 beat markers (s): {[round(t, 3) for t in beat_times[:8]]}")
        diffs = np.diff(beat_times)
        median_ibi = np.median(diffs)
        bpm_from_ibi = 60.0 / median_ibi
        print(f"Median Inter-Beat Interval: {median_ibi:.4f}s -> {bpm_from_ibi:.2f} BPM")
    
    # 4. Check kicks/low frequency energy for downbeat alignment
    # 藤井風の曲などは、最初の本打ち（ドラムのキック）が始まる位置がダウンビート
    # onset envelope が閾値を超えて本格的にビートが立ち上がる最初の強いビートを調査
    threshold = np.max(onset_env) * 0.15
    active_onsets = librosa.onset.onset_detect(y=y, sr=sr, onset_envelope=onset_env, units='time')
    strong_onsets = [t for t in active_onsets if onset_env[librosa.time_to_frames(t, sr=sr)] > threshold]
    first_strong_onset = strong_onsets[0] if len(strong_onsets) > 0 else (beat_times[0] if beat_times else 0.0)
    print(f"First prominent onset: {first_strong_onset:.3f}s")
    
    return {
        "title": os.path.basename(song_dir),
        "file": target_file,
        "duration": duration,
        "bpm": round(detected_bpm, 2),
        "bpm_median": round(bpm_from_ibi, 2) if len(beat_times) > 0 else round(detected_bpm, 2),
        "first_beat": round(beat_times[0], 4) if len(beat_times) > 0 else 0.0,
        "first_strong_onset": round(first_strong_onset, 4),
        "beat_times": [round(t, 4) for t in beat_times]
    }

dirs = sorted(glob.glob("public/stems/*"))
results = {}
for d in dirs:
    if os.path.isdir(d):
        res = analyze_song(d)
        results[os.path.basename(d)] = res

with open("scripts/librosa_analysis.json", "w", encoding="utf-8") as f:
    json.dump(results, f, indent=2, ensure_ascii=False)

print("\nAnalysis saved to scripts/librosa_analysis.json")
