import json
import os
from ..constants import DATA_DIR, SAVE_DIR

def load_json_data(filename):
    """Loads data from a JSON file in the data directory."""
    filepath = os.path.join(DATA_DIR, filename)
    try:
        with open(filepath, 'r', encoding='utf-8') as f: # Specify UTF-8 encoding
            # Check if file is empty before trying to decode
            content = f.read()
            if not content:
                print(f"Error: File is empty: {filepath}")
                return None # Or raise an error, or return default data
            # Reset read pointer and decode
            # f.seek(0) # Not needed if reading whole content first
            data = json.loads(content) # Use json.loads on the read content
            return data
    except FileNotFoundError:
        print(f"Error: File not found: {filepath}")
        return None # Or raise an error
    except json.JSONDecodeError as e:
        # Provide more specific JSON error details
        print(f"Error: Could not decode JSON from {filepath}")
        print(f"  Reason: {e.msg}")
        print(f"  At line {e.lineno}, column {e.colno}")
        # Optionally print the problematic content snippet if needed for debugging
        # print(f"  Content near error: '{e.doc[max(0, e.pos-10):e.pos+10]}'")
        return None # Or raise an error
    except Exception as e:
        # Catch other potential errors like permission issues
        print(f"Error loading file {filepath}: {e}")
        return None

def save_game(game_state_dict, filename="savegame.json"):
    """Saves the game state dictionary to a JSON file in the saves directory."""
    if not os.path.exists(SAVE_DIR):
        try:
            os.makedirs(SAVE_DIR)
        except OSError as e:
            print(f"Error creating save directory {SAVE_DIR}: {e}")
            return False # Indicate save failure

    filepath = os.path.join(SAVE_DIR, filename)
    try:
        with open(filepath, 'w', encoding='utf-8') as f: # Specify UTF-8 encoding
            json.dump(game_state_dict, f, indent=2)
        return True # Indicate save success
    except TypeError as e:
        print(f"Error: Could not serialize game state to JSON: {e}")
        return False
    except Exception as e:
        print(f"Error saving game to {filepath}: {e}")
        return False

def load_game(filename="savegame.json"):
    """Loads the game state dictionary from a JSON file in the saves directory."""
    filepath = os.path.join(SAVE_DIR, filename)
    try:
        with open(filepath, 'r', encoding='utf-8') as f: # Specify UTF-8 encoding
            content = f.read()
            if not content:
                print(f"Error: Save file is empty: {filepath}")
                return None
            game_state_dict = json.loads(content)
            return game_state_dict
    except FileNotFoundError:
        print(f"Info: No save file found at {filepath}")
        return None # Normal case if no game saved yet
    except json.JSONDecodeError as e:
        print(f"Error: Could not decode save game JSON from {filepath}")
        print(f"  Reason: {e.msg}")
        print(f"  At line {e.lineno}, column {e.colno}")
        return None # Treat as corrupted save
    except Exception as e:
        print(f"Error loading save game from {filepath}: {e}")
        return None