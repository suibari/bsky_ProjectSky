import { writable } from "svelte/store";

export type SoundKey =
    | "draw"
    | "label"
    | "postcard"
    | "rankup"
    | "result"
    | "score"
    | "turnchange"
    | "usercard";

const SOUND_FILES: Record<SoundKey, string> = {
    draw: "/se/draw.mp3",
    label: "/se/label.mp3",
    postcard: "/se/postcard.mp3",
    rankup: "/se/rankup.mp3",
    result: "/se/result.mp3",
    score: "/se/score.mp3",
    turnchange: "/se/turnchange.mp3",
    usercard: "/se/usercard.mp3",
};

class SoundManager {
    private sounds: Record<string, HTMLAudioElement> = {};
    public isEnabled = writable(false);

    constructor() {
        if (typeof window !== "undefined") {
            // Load preference
            const stored = localStorage.getItem("se_enabled");
            const enabled = stored === "true"; // Default is false
            this.isEnabled.set(enabled);

            // Preload sounds
            Object.entries(SOUND_FILES).forEach(([key, path]) => {
                const audio = new Audio(path);
                audio.preload = "auto";
                this.sounds[key] = audio;
            });
        }
    }

    toggle() {
        this.isEnabled.update((v) => {
            const newValue = !v;
            if (typeof window !== "undefined") {
                localStorage.setItem("se_enabled", String(newValue));
            }
            return newValue;
        });
    }

    play(key: SoundKey, count: number = 1, delayMs: number = 0) {
        // Subscribe just once to check if enabled
        let enabled = false;
        const unsub = this.isEnabled.subscribe((v) => (enabled = v));
        unsub();

        if (!enabled) return;

        if (typeof window !== "undefined") {
            const audio = this.sounds[key];
            if (audio) {
                if (count > 1) {
                    // Play multiple times with delay
                    for (let i = 0; i < count; i++) {
                        setTimeout(() => {
                            this.cloneAndPlay(audio);
                        }, i * 150); // Hardcoded stagger for now, or pass in
                    }
                } else if (delayMs > 0) {
                    setTimeout(() => {
                        this.cloneAndPlay(audio);
                    }, delayMs);
                } else {
                    this.cloneAndPlay(audio);
                }
            }
        }
    }

    private cloneAndPlay(original: HTMLAudioElement) {
        // Clone node to allow overlapping sounds of same type
        const clone = original.cloneNode() as HTMLAudioElement;
        clone.volume = 0.5; // Default volume bit lower?
        clone.play().catch((e) => console.warn("Audio play failed", e));
    }
}

export const soundManager = new SoundManager();
