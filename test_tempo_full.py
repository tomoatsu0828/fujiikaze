import os
import subprocess
import wave
import struct

def find_exact_tempo_across_song(mp3_path, song_name):
    wav = "/tmp/full_tempo.wav"
    # Convert first 200 seconds to 22050Hz mono
    subprocess.run(["ffmpeg", "-y", "-i", mp3_path, "-t", "200", "-ar", "22050", "-ac", "1", wav],
                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    with wave.open(wav, "r") as wf:
        n = wf.getnframes()
        samples = [s / 32768.0 for s in struct.unpack(f"<{n}h", wf.readframes(n))]
    os.remove(wav)

    sr = 22050
    # Compute energy in 10ms hops
    hop = int(sr * 0.01) # 10ms
    rms = []
    for i in range(0, len(samples), hop):
        c = samples[i:i+hop]
        rms.append((sum(s*s for s in c)/len(c))**0.5)

    # Compute flux / onset
    flux = [0.0] + [max(0.0, rms[i] - rms[i-1]) for i in range(1, len(rms))]

    # Find strong beat onsets between 30s and 180s
    start_frame = int(30.0 / 0.01)
    end_frame = min(len(flux), int(180.0 / 0.01))

    # Test candidate BPMs from 60 to 180 with 0.01 step!
    # Using Discrete Fourier Transform of the onset envelope (Tempo Periodicity)
    best_bpm = 0.0
    best_power = -1.0

    print(f"\n==========================================")
    print(f"SEARCHING PRECISE BPM FOR: {song_name}")
    print(f"==========================================")

    # Let's test BPM range around expected
    for test_bpm_x100 in range(6000, 16000, 5): # 60.00 to 160.00, step 0.05
        bpm = test_bpm_x100 / 100.0
        spb = 60.0 / bpm
        period_frames = spb / 0.01

        # Calculate autocorrelation / comb filter response across 30s..160s
        # Sum of flux[i] * flux[i + period]
        score = 0.0
        count = 0
        step_f = int(round(period_frames))
        if step_f < 5: continue
        for i in range(start_frame, end_frame - step_f * 4, step_f):
            score += flux[i] * flux[i + step_f]
            count += 1
        if count > 0:
            avg_score = score / count
            if avg_score > best_power:
                best_power = avg_score
                best_bpm = bpm

    # Now let's do high resolution search +/- 1 BPM around best_bpm with 0.01 step
    fine_best_bpm = best_bpm
    fine_best_power = -1.0
    for test_bpm_x100 in range(int((best_bpm - 1.5)*100), int((best_bpm + 1.5)*100)):
        bpm = test_bpm_x100 / 100.0
        spb = 60.0 / bpm
        period_frames = spb / 0.01
        
        # Test pulse train alignment
        # Best offset for this BPM
        num_offsets = 20
        max_offset_score = 0.0
        for off_i in range(num_offsets):
            off_sec = (off_i / num_offsets) * spb
            s = 0.0
            t = 30.0 + off_sec
            while t < 160.0:
                idx = int(t / 0.01)
                if idx < len(flux):
                    s += flux[idx]
                t += spb
            if s > max_offset_score:
                max_offset_score = s
        if max_offset_score > fine_best_power:
            fine_best_power = max_offset_score
            fine_best_bpm = bpm

    print(f"[{song_name}] -> Most prominent periodicity: {best_bpm:.2f} BPM, Fine-aligned: {fine_best_bpm:.2f} BPM")
    return fine_best_bpm

find_exact_tempo_across_song("public/stems/2．damn/2．damn_drums_mixed.mp3", "damn (Drums)")
find_exact_tempo_across_song("public/stems/1．燃えよ/１．燃えよ_drums_mixed.mp3", "燃えよ (Drums)")
find_exact_tempo_across_song("public/stems/3．旅路/３．旅路_drums_mixed.mp3", "旅路 (Drums)")
find_exact_tempo_across_song("public/stems/5．Hachikō/5．Hachikō_drums_mixed.mp3", "Hachiko (Drums)")
