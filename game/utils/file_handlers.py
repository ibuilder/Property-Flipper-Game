import json
import os
from ..entities.property import Property # Need Property for reconstruction
from ..entities.upgrade import Upgrade # Need Upgrade for reconstruction
from ..player import Player # Ensure Player is imported
from ..constants import STARTING_CASH # Ensure STARTING_CASH is imported

SAVE_DIR = "saves"
SAVE_FILENAME = "savegame.json"

def load_json_data(filename):
    """Loads data from a JSON file."""
    filepath = os.path.join('data', filename)
    try:
        with open(filepath, 'r') as f:
            data = json.load(f)
            print(f"Successfully loaded data from {filepath}")
            return data
    except FileNotFoundError:
        print(f"Error: Data file not found at {filepath}")
        return None
    except json.JSONDecodeError:
        print(f"Error: Could not decode JSON from {filepath}")
        return None
    except Exception as e:
        print(f"An unexpected error occurred while loading {filepath}: {e}")
        return None

def serialize_property(prop):
    """Converts a Property object into a serializable dictionary."""
    # Store type/location by ID, applied upgrades by ID
    ongoing_upgrade_id = None
    time_left = 0
    if prop.renovation_progress:
        ongoing_upgrade_id = prop.renovation_progress['upgrade'].id
        time_left = prop.renovation_progress['time_left']

    return {
        "id": prop.id,
        # Store the key/ID of the property type, not the whole dict
        "type_id": next((k for k, v in prop.game_state_ref.property_types.items() if v == prop.type), None) if hasattr(prop, 'game_state_ref') else prop.type.get('id', None), # Requires linking GameState or storing type_id on property
        "location_id": prop.location,
        "condition": prop.condition,
        "applied_upgrade_ids": [up.id for up in prop.upgrades],
        "ongoing_upgrade_id": ongoing_upgrade_id,
        "renovation_time_left": time_left
    }

def deserialize_property(prop_data, game_state):
    """Reconstructs a Property object from saved data."""
    prop_type_dict = game_state.property_types.get(prop_data["type_id"])
    if not prop_type_dict:
        print(f"Warning: Could not find property type '{prop_data['type_id']}' during load. Skipping property {prop_data['id']}.")
        return None

    prop = Property(
        property_id=prop_data["id"],
        property_type=prop_type_dict, # Link the actual type dict
        location=prop_data["location_id"],
        condition=prop_data["condition"]
    )
    # Add a reference back to game_state if needed for serialization later
    # prop.game_state_ref = game_state

    # Reconstruct applied upgrades
    for up_id in prop_data["applied_upgrade_ids"]:
        upgrade_data = game_state.upgrade_types.get(up_id)
        if upgrade_data:
             # Create Upgrade instance
             upgrade_obj = Upgrade(
                 upgrade_id=up_id,
                 name=upgrade_data.get("name", "Unknown"), cost=upgrade_data.get("cost", 0),
                 value_increase=upgrade_data.get("value_increase", 0),
                 condition_increase=upgrade_data.get("condition_increase", 0),
                 time_required=upgrade_data.get("time_required", 1)
             )
             prop.upgrades.append(upgrade_obj)
        else:
             print(f"Warning: Could not find applied upgrade '{up_id}' for property {prop.id} during load.")

    # Reconstruct ongoing renovation
    ongoing_id = prop_data.get("ongoing_upgrade_id")
    if ongoing_id:
        upgrade_data = game_state.upgrade_types.get(ongoing_id)
        if upgrade_data:
             upgrade_obj = Upgrade(
                 upgrade_id=ongoing_id,
                 name=upgrade_data.get("name", "Unknown"), cost=upgrade_data.get("cost", 0),
                 value_increase=upgrade_data.get("value_increase", 0),
                 condition_increase=upgrade_data.get("condition_increase", 0),
                 time_required=upgrade_data.get("time_required", 1)
             )
             prop.renovation_progress = {
                 'upgrade': upgrade_obj,
                 'time_left': prop_data.get("renovation_time_left", 0)
             }
        else:
             print(f"Warning: Could not find ongoing upgrade '{ongoing_id}' for property {prop.id} during load.")

    return prop


def save_game(game_state):
    """Saves the current game state to a JSON file."""
    if not os.path.exists(SAVE_DIR):
        os.makedirs(SAVE_DIR)
    save_path = os.path.join(SAVE_DIR, SAVE_FILENAME)

    # Add reference to game_state in properties for serialization
    # This is a bit hacky, consider a better way if scaling up
    for prop in game_state.player.properties:
        prop.game_state_ref = game_state
    for prop in game_state.properties_for_sale:
         prop.game_state_ref = game_state

    save_data = {
        "game_time": game_state.game_time,
        "player": {
            "cash": game_state.player.cash,
            "properties": [serialize_property(prop) for prop in game_state.player.properties],
            "current_loan": game_state.player.current_loan,
            "has_contractor": game_state.player.has_contractor,
            "skills": game_state.player.skills # <<< SAVE SKILLS
        },
        "properties_for_sale": [serialize_property(prop) for prop in game_state.properties_for_sale],
        "active_events": game_state.active_events, # <<< SAVE ACTIVE EVENTS
        "_next_prop_id_counter": game_state._next_prop_id_counter, # <<< SAVE ID COUNTER
        "game_won": game_state.game_won, # <<< SAVE WIN STATE
        "game_lost": game_state.game_lost # <<< SAVE LOSE STATE
    }

    # Remove temporary reference after serialization
    for prop in game_state.player.properties:
         if hasattr(prop, 'game_state_ref'): del prop.game_state_ref
    for prop in game_state.properties_for_sale:
         if hasattr(prop, 'game_state_ref'): del prop.game_state_ref

    try:
        with open(save_path, 'w') as f:
            json.dump(save_data, f, indent=2)
        print(f"Game saved successfully to {save_path}")
        return True
    except Exception as e:
        print(f"Error saving game: {e}")
        return False

def load_game(game_state):
    """Loads game state from a JSON file into the provided GameState object."""
    save_path = os.path.join(SAVE_DIR, SAVE_FILENAME)
    if not os.path.exists(save_path):
        print("No save file found.")
        return False

    try:
        with open(save_path, 'r') as f:
            save_data = json.load(f)

        # Load core data
        game_state.game_time = save_data.get("game_time", 0)
        game_state.active_events = save_data.get("active_events", [])
        game_state._next_prop_id_counter = save_data.get("_next_prop_id_counter", 1)
        game_state.game_won = save_data.get("game_won", False) # <<< LOAD WIN STATE
        game_state.game_lost = save_data.get("game_lost", False) # <<< LOAD LOSE STATE

        # Load player
        player_data = save_data.get("player", {})
        game_state.player = Player(player_data.get("cash", STARTING_CASH))
        game_state.player.current_loan = player_data.get("current_loan", 0)
        game_state.player.has_contractor = player_data.get("has_contractor", False)

        # Load skills, providing defaults for any missing skills
        default_skills = {"negotiation": 1, "handiness": 1, "marketing": 1}
        loaded_skills_data = player_data.get("skills", {})
        # Merge loaded data with defaults, ensuring all skills exist
        final_skills = {**default_skills, **loaded_skills_data}
        game_state.player.skills = final_skills # <<< LOAD SKILLS WITH DEFAULTS

        game_state.player.link_game_state(game_state)

        # Load player properties
        game_state.player.properties = []
        loaded_player_props = player_data.get("properties", [])
        for prop_data in loaded_player_props:
            prop = deserialize_property(prop_data, game_state)
            if prop:
                game_state.player.properties.append(prop)

        # Load properties for sale
        game_state.properties_for_sale = []
        loaded_market_props = save_data.get("properties_for_sale", [])
        for prop_data in loaded_market_props:
             prop = deserialize_property(prop_data, game_state)
             if prop:
                 game_state.properties_for_sale.append(prop)

        # Reset UI state or set based on loaded game state
        if game_state.game_won:
            game_state.current_view = "win_screen"
        elif game_state.game_lost:
            game_state.current_view = "game_over_screen"
        else:
            game_state.current_view = "main_menu" # Default view if game not ended
        game_state.selected_property_for_renovation = None

        # Ensure market multipliers reflect loaded events
        game_state.market.reset_multipliers()

        print(f"Game loaded successfully from {save_path}. Win: {game_state.game_won}, Lost: {game_state.game_lost}, Loan: ${game_state.player.current_loan:,.0f}, Contractor: {game_state.player.has_contractor}") # Add contractor to log
        return True

    except Exception as e:
        print(f"Error loading game: {e}")
        return False

# Need STARTING_CASH for default in load_game
# A bit awkward to import here, consider passing defaults or restructuring
try:
    from ..constants import STARTING_CASH
except ImportError:
    STARTING_CASH = 50000 # Fallback default