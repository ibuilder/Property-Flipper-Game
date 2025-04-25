import random
import uuid
from .constants import *
from .player import Player
from .entities.property import Property
from .utils.file_handlers import load_json_data, save_game, load_game

class GameState:
    def __init__(self):
        # Load game data
        self.properties_data = load_json_data("properties.json")
        self.locations_data = load_json_data("locations.json")
        self.upgrades_data = load_json_data("upgrades.json")
        self.events_data = load_json_data("market_events.json") # This loads a LIST

        # Check if data loading failed
        if not all([self.properties_data, self.locations_data, self.upgrades_data, self.events_data]):
            raise ValueError("Failed to load essential game data (properties, locations, upgrades, or events). Check data files and logs.")

        self.player = Player(STARTING_CASH)
        self.player.link_game_state(self) # Link player back to game state
        self.market_properties = self._generate_initial_market()
        self.current_day = 1
        self.current_view = "main_menu" # Start at the main menu
        self.game_over_message = "" # For win/loss messages
        self.active_event = None
        self.event_days_remaining = 0

        # Process Event Data Correctly
        self.event_definitions = {}
        for event_dict in self.events_data:
            if isinstance(event_dict, dict) and 'name' in event_dict:
                self.event_definitions[event_dict['name']] = event_dict
            else:
                print(f"Warning: Skipping invalid item in market_events.json: {event_dict}")


    def _generate_initial_market(self, count=5):
        market = []
        if not self.properties_data or not self.locations_data:
             print("Warning: Cannot generate market properties due to missing properties or locations data.")
             return market

        # Use a simple counter or uuid for unique IDs
        # Using uuid is generally safer for ensuring uniqueness if properties might be added/removed dynamically
        # property_id_counter = 0 # Alternative: simple counter

        for _ in range(count):
            prop_type_data = random.choice(self.properties_data)
            location_data = random.choice(self.locations_data)

            if not isinstance(prop_type_data, dict) or not isinstance(location_data, dict):
                print(f"Warning: Skipping market property generation due to invalid data item.")
                continue

            # Generate a unique ID
            prop_id = str(uuid.uuid4()) # Generate a unique string ID
            # property_id_counter += 1 # Alternative: simple counter
            # prop_id = f"market_{property_id_counter}" # Alternative: simple counter ID

            # Create property instance - ADD 'property_id' ARGUMENT
            prop = Property(
                property_id=prop_id, # <<< ADDED property_id
                property_type=prop_type_data.get("type", "Unknown Type"),
                location=location_data.get("name", "Unknown Location")
                # base_value=prop_type_data.get("base_value", 50000), # REMOVED
                # base_condition=prop_type_data.get("base_condition", 0.5), # REMOVED
                # location_modifier=location_data.get("market_modifier", 1.0) # REMOVED
            )
            # Store base values and modifier from data onto the object AFTER creation
            prop.base_value_from_data = prop_type_data.get("base_value", 50000)
            prop.base_condition = prop_type_data.get("base_condition", 0.5)
            prop.location_modifier = location_data.get("market_modifier", 1.0)

            # Set initial condition using the stored base_condition
            prop.condition = max(0.1, min(1.0, prop.base_condition + random.uniform(-0.1, 0.1)))

            market.append(prop)
        return market

    # --- Event Handling ---
    def check_for_new_event(self):
        """Checks if a new market event should start."""
        if self.active_event is None and random.random() < EVENT_CHANCE_PER_DAY:
            possible_events = list(self.event_definitions.values())
            if possible_events:
                self.active_event = random.choice(possible_events)
                self.event_days_remaining = EVENT_DURATION_DAYS # Use constant for duration
                print(f"EVENT START (Day {self.current_day}): {self.active_event.get('name', 'Unnamed Event')} - {self.active_event.get('description', '')}")

    def get_market_modifiers(self):
        """Returns current market modifiers based on active event."""
        if self.active_event and self.event_days_remaining > 0:
            effects = self.active_event.get('effects', {})
            if isinstance(effects, dict):
                 return (
                     effects.get('value_modifier', 1.0),
                     effects.get('cost_modifier', 1.0),
                     effects.get('time_modifier', 1.0)
                 )
        return (1.0, 1.0, 1.0) # Default modifiers

    # --- Day Advancement & Game State Update ---
    def advance_day(self):
        """Advances the game by one day, applying costs, updating progress, and checking events."""
        self.current_day += 1
        print(f"--- Advancing to Day {self.current_day} ---")

        # 1. Apply daily costs (interest, taxes, wages) via Player method
        self.player.apply_daily_costs()

        # 2. Update renovation progress via Player method
        self.player.update_renovations() # This method handles progress increment

        # 3. Update market event duration or check for new event
        if self.active_event:
            self.event_days_remaining -= 1
            if self.event_days_remaining <= 0:
                print(f"EVENT END (Day {self.current_day}): {self.active_event.get('name', 'Unnamed Event')}")
                self.active_event = None
            # else: # Optional: Print remaining days
                # print(f"Event '{self.active_event.get('name')}' active for {self.event_days_remaining} more days.")
        else:
            # Check if a new event should start
            self.check_for_new_event() # Uses EVENT_CHANCE_PER_DAY

        # 4. Potentially refresh market properties (optional, add complexity)
        # self._refresh_market()

        # 5. Check for win/loss conditions
        self.check_win_loss()

        # Ensure no reference to 'game_time' exists here. All logic should use
        # current_day or simply react to the fact that a day has passed.

    def check_win_loss(self):
        """Checks if the win or loss conditions are met."""
        if self.player.cash >= WIN_CONDITION_CASH:
            self.game_over_message = f"Congratulations! You reached ${WIN_CONDITION_CASH:,.0f} and won!"
            self.current_view = "game_over_view" # Switch to game over screen
            # Play win sound if sound manager is available
            if hasattr(self, 'sound_manager'):
                 self.sound_manager.play("win")

        # Loss condition: Negative cash AND no properties left to sell
        elif self.player.cash < 0 and not self.player.properties:
            self.game_over_message = "Game Over! You went bankrupt."
            self.current_view = "game_over_view" # Switch to game over screen
            # Play lose sound if sound manager is available
            if hasattr(self, 'sound_manager'):
                 self.sound_manager.play("lose")


    # --- Save/Load ---
    def get_state_dict(self):
        """Returns a dictionary representing the game state."""
        return {
            'player': self.player.get_state_dict(),
            'market_properties': [prop.get_state_dict() for prop in self.market_properties],
            'current_day': self.current_day,
            'active_event_name': self.active_event['name'] if self.active_event else None,
            'event_days_remaining': self.event_days_remaining
            # DO NOT save volatile data like event_definitions, properties_data etc.
        }

    def load_state_dict(self, state_dict):
        """Loads the game state from a dictionary."""
        try:
            # Load player first (it might need game_state link later)
            self.player.load_state_dict(state_dict['player'])

            # Load market properties
            self.market_properties = [Property.from_state_dict(p_dict) for p_dict in state_dict['market_properties']]

            # Load simple attributes
            self.current_day = state_dict.get('current_day', 1)
            self.event_days_remaining = state_dict.get('event_days_remaining', 0)

            # Restore active event using the saved name and loaded definitions
            active_event_name = state_dict.get('active_event_name')
            if active_event_name and active_event_name in self.event_definitions:
                self.active_event = self.event_definitions[active_event_name]
            else:
                self.active_event = None # No active event or event definition not found

            # Re-link player to the now loaded game state
            self.player.link_game_state(self)

            # Reset view and message
            self.current_view = "main_menu"
            self.game_over_message = ""

            print(f"Game loaded successfully. Resuming on Day {self.current_day}.")
            return True
        except KeyError as e:
            print(f"Error loading game state: Missing key {e}")
            return False
        except Exception as e:
            print(f"Error loading game state: {e}")
            return False

    # --- Other Helper Methods ---
    def get_property_by_id(self, property_id):
        """Finds a property (owned or on market) by its ID."""
        # Check player properties
        for prop in self.player.properties:
            if prop.property_id == property_id:
                return prop
        # Check market properties
        for prop in self.market_properties:
            if prop.property_id == property_id:
                return prop
        return None # Not found