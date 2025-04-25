# filepath: c:\Users\iphoe\OneDrive\Documents\GitHub\Property-Flipper-Game\game\utils\sound_manager.py
import pygame
import os
from ..constants import SOUND_DIR

class SoundManager:
    def __init__(self):
        self.sounds = {}
        self.is_initialized = False
        try:
            pygame.mixer.init()
            self.is_initialized = True
            print("Pygame mixer initialized successfully.")
        except pygame.error as e:
            print(f"Error initializing pygame mixer: {e}. Sound effects will be disabled.")

    def load_sound(self, name, filename):
        """Loads a sound file if the mixer is initialized."""
        if not self.is_initialized:
            return
        
        path = os.path.join(SOUND_DIR, filename)
        if not os.path.exists(path):
            print(f"Warning: Sound file not found: {path}")
            return
            
        try:
            sound = pygame.mixer.Sound(path)
            self.sounds[name] = sound
            print(f"Loaded sound: {name} from {path}")
        except pygame.error as e:
            print(f"Error loading sound '{name}' from {path}: {e}")
        except Exception as e:
            print(f"Unexpected error loading sound '{name}': {e}")

    def play(self, name):
        """Plays a loaded sound if the mixer is initialized."""
        if not self.is_initialized:
            return
        if name in self.sounds:
            try:
                self.sounds[name].play()
            except pygame.error as e:
                print(f"Error playing sound '{name}': {e}")
        # else:
            # print(f"Warning: Sound '{name}' not loaded or found.") # Optional: Can be noisy

# Global instance (Singleton pattern)
sound_manager = SoundManager()