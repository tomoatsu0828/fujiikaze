import os
import glob
import json
import numpy as np

def generate_full_beatmap():
    with open("scripts/librosa_detailed_analysis.json", "r", encoding="utf-8") as f:
        analysis = json.load(f)

    beatmaps = {}

    for title, data in analysis.items():
        bpm = data["bpm"]
        ibi = data["median_ibi"]
        raw_beats = sorted(data["beat_times"])
        
        # 代表的なダウンビート（1小節目1拍目の基準点）
        downbeat = data["downbeat_time"]
        
        # 1. イントロ方向（0秒まで）にバックフィルして、曲頭からのビートグリッドを完成させる
        curr = raw_beats[0]
        backfilled = []
        while curr - ibi >= 0.05:
            curr -= ibi
            backfilled.append(round(curr, 4))
        backfilled.reverse()
        
        full_beats = backfilled + [round(b, 4) for b in raw_beats]
        
        # 重複や近接（< 0.1s）を除去
        cleaned_beats = []
        for b in full_beats:
            if not cleaned_beats or (b - cleaned_beats[-1]) > (ibi * 0.6):
                cleaned_beats.append(b)
                
        # 最初のダウンビート（小節頭）を特定
        # 代表ダウンビートに最も近いビートインデックス
        closest_idx = min(range(len(cleaned_beats)), key=lambda i: abs(cleaned_beats[i] - downbeat))
        # 4拍子として、0小節頭（ビート0）に相当する位置を特定
        bar_start_idx = closest_idx % 4
        first_downbeat = cleaned_beats[bar_start_idx]
        
        beatmaps[title] = {
            "bpm": bpm,
            "beatOffset": round(first_downbeat, 4),
            "medianIbi": round(ibi, 4),
            "downbeatRef": round(downbeat, 4),
            "beatTimes": cleaned_beats
        }
        print(f"Generated beatmap for {title}: BPM={bpm}, Offset={first_downbeat}s, Total Beats={len(cleaned_beats)}")

    with open("scripts/beatmaps.json", "w", encoding="utf-8") as f:
        json.dump(beatmaps, f, indent=2, ensure_ascii=False)
    print("Saved scripts/beatmaps.json successfully.")

if __name__ == "__main__":
    generate_full_beatmap()
