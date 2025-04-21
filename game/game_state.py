from .utils.file_handlers import load_json_data
from .player import Player
from .market import Market
from .entities.property import Property # Import Property
from .entities.upgrade import Upgrade # Import Upgrade
from .constants import STARTING_CASH # Import STARTING_CASH
from .constants import WIN_CONDITION_CASH # Import win condition
import random # Import random module

class GameState:
    def __init__(self):
        self.game_time = 0  # Time in days

        # Load game data
        self.property_types = load_json_data('properties.json') or {}
        self.upgrade_types = load_json_data('upgrades.json') or {}
        self.locations = load_json_data('locations.json') or {} # Assuming locations.json exists
        self.market_events_data = load_json_data('market_events.json') or {} # Raw event data

        self.properties_for_sale = [] # List of Property objects available to buy
        self.active_events = [] # List of dicts: {'id': str, 'name': str, 'effects': list, 'duration_left': int}

        # Market settings
        self.max_properties_on_market = 10 # Max listings at any time
        self.new_property_chance = 0.3 # Chance to add a new property each day (if below max)
        self._next_prop_id_counter = 1 # For generating unique IDs

        # Event settings
        self.event_trigger_chance_per_day = 0.05 # Chance an event starts each day
        self.max_active_events = 1 # Limit concurrent events (can increase later)

        # Initialize core components
        self.market = Market(self.locations) # Pass location data to Market
        self.player = Player(STARTING_CASH)
        self.player.link_game_state(self) # <<< Link game_state to player

        # Link components (optional, could pass GameState around instead)
        # self.player.game_state = self # If player needs access
        # self.market.game_state = self # If market needs access

        self.current_view = "main_menu"  # Current UI view
        self.selected_property_for_renovation = None # <<< ADD THIS ATTRIBUTE
        self.game_won = False # Track if the win condition is met
        self.game_lost = False # Track if the lose condition is met

        # --- Populate initial state ---
        self._create_initial_properties() # Create some properties for sale
        # Determine starting ID counter based on initial properties
        self._next_prop_id_counter = self._get_next_available_prop_id()
        print(f"Initial properties created. Next property ID: {self._next_prop_id_counter}")

    def _get_next_available_prop_id(self):
        """Finds the next available integer ID based on existing properties."""
        max_id = 0
        all_props = self.properties_for_sale + self.player.properties # Check owned too, if loading saves
        for prop in all_props:
            try:
                # Assumes IDs are like "prop_001", "prop_123"
                num_part = int(prop.id.split('_')[-1])
                if num_part > max_id:
                    max_id = num_part
            except (ValueError, IndexError):
                continue # Ignore IDs not in the expected format
        return max_id + 1

    def _create_initial_properties(self):
        """Creates some starting properties available on the market."""
        # Clear existing list first
        self.properties_for_sale = []
        # Example: Create a couple of starter homes if data is loaded
        if "starter_home" in self.property_types and "suburbs" in self.locations:
            prop1 = Property(
                property_id=f"prop_{self._next_prop_id_counter:03d}", # Use counter for ID
                property_type=self.property_types["starter_home"], # Pass the actual dict
                location="suburbs",
                condition=random.randint(50, 80) # Randomize condition
            )
            self.properties_for_sale.append(prop1)
            self._next_prop_id_counter += 1

        if "suburban_house" in self.property_types and "downtown" in self.locations:
             prop2 = Property(
                 property_id=f"prop_{self._next_prop_id_counter:03d}", # Use counter for ID
                 property_type=self.property_types["suburban_house"], # Pass the actual dict
                 location="downtown",
                 condition=random.randint(40, 70) # Randomize condition
             )
             self.properties_for_sale.append(prop2)
             self._next_prop_id_counter += 1
        # Add more initial properties if desired
        print(f"Created {len(self.properties_for_sale)} initial properties for sale.")

    def _generate_new_property_for_sale(self):
        """Generates a new random property and adds it to the market."""
        if not self.property_types or not self.locations:
            print("Cannot generate property: Property types or locations not loaded.")
            return

        # Choose random type and location
        chosen_type_id = random.choice(list(self.property_types.keys()))
        chosen_location_id = random.choice(list(self.locations.keys()))
        chosen_type_data = self.property_types[chosen_type_id]

        # Generate random condition (e.g., lower for cheaper, higher for expensive?)
        initial_condition = random.randint(30, 85)

        # Create property
        new_prop_id = f"prop_{self._next_prop_id_counter:03d}"
        self._next_prop_id_counter += 1

        new_prop = Property(
            property_id=new_prop_id,
            property_type=chosen_type_data,
            location=chosen_location_id,
            condition=initial_condition
        )
        self.properties_for_sale.append(new_prop)
        print(f"New property generated: {new_prop.type.get('name', 'N/A')} ({new_prop_id}) in {chosen_location_id}")

    def _update_market_events(self, days_passed):
        """Updates active events, removing expired ones and potentially triggering new ones."""
        # Decrement duration of active events
        expired_events = []
        for event in self.active_events:
            event['duration_left'] -= days_passed
            if event['duration_left'] <= 0:
                expired_events.append(event)

        # Remove expired events
        for event in expired_events:
            self.active_events.remove(event)
            print(f"Market event expired: {event['name']}")
            # Trigger recalculation of market multipliers if needed immediately
            self.market.reset_multipliers() # Add this method to Market

        # Trigger new event?
        if not self.market_events_data: return # No event data loaded

        if len(self.active_events) < self.max_active_events:
            if random.random() < self.event_trigger_chance_per_day:
                # Select a random event that isn't already active
                available_event_ids = list(self.market_events_data.keys())
                active_event_ids = [e['id'] for e in self.active_events]
                possible_new_events = [eid for eid in available_event_ids if eid not in active_event_ids]

                if possible_new_events:
                    chosen_event_id = random.choice(possible_new_events)
                    event_data = self.market_events_data[chosen_event_id]
                    new_event = {
                        'id': chosen_event_id,
                        'name': event_data.get('name', 'Unnamed Event'),
                        'effects': event_data.get('effects', []),
                        'duration_left': event_data.get('duration', 10) # Default duration 10 days
                    }
                    self.active_events.append(new_event)
                    print(f"New market event started: {new_event['name']} (Duration: {new_event['duration_left']} days)")
                    # Trigger recalculation of market multipliers
                    self.market.reset_multipliers() # Add this method to Market

    def get_active_event_modifier(self, location_id, effect_type="value_multiplier"):
        """Calculates the combined modifier from active events for a specific location and effect type."""
        # Using 1.0 as the base for multiplicative effects
        # Using 0.0 as the base for additive effects (if any were added)
        total_modifier = 1.0 # Assume multiplicative for now

        for event in self.active_events:
            for effect in event.get('effects', []):
                if effect.get('type') == effect_type:
                    applies_to_location = effect.get('location', 'all')
                    if applies_to_location == 'all' or applies_to_location == location_id:
                        # Apply the modifier (multiplicative)
                        total_modifier *= effect.get('amount', 1.0)
        return total_modifier

    def check_win_condition(self):
        """Checks if the player has met the win condition."""
        if not self.game_won and not self.game_lost and self.player.cash >= WIN_CONDITION_CASH:
            self.game_won = True
            self.current_view = "win_screen" # Switch to win screen
            print("--- WIN CONDITION MET! ---")

    def check_lose_condition(self):
        """Checks if the player has met the lose condition (bankruptcy)."""
        if not self.game_won and not self.game_lost:
            # Check if cash is negative AND player has no properties left to potentially sell
            if self.player.cash < 0 and not self.player.properties:
                self.game_lost = True
                self.current_view = "game_over_screen" # Switch to game over screen
                print("--- LOSE CONDITION MET! (Bankruptcy) ---")

    def update(self, dt):
        """Update game state (e.g., check win/lose conditions)."""
        if not self.game_won and not self.game_lost:
            self.check_win_condition()
            self.check_lose_condition() # Check lose condition every frame/update

    def advance_day(self):
        """Advances the game simulation by one day."""
        if self.game_won or self.game_lost: return

        days_to_advance = 1
        self.game_time += days_to_advance
        print(f"--- Advancing to Day {int(self.game_time)} ---")

        # Player update (handles interest, taxes, and renovations daily)
        self.player.update(days_to_advance, self.market, self) # <<< PASS self (game_state)

        # --- Market Updates ---
        self._update_market_events(days_to_advance)
        if len(self.properties_for_sale) < self.max_properties_on_market:
            if random.random() < self.new_property_chance:
                self._generate_new_property_for_sale()

        print(f"Properties on market: {len(self.properties_for_sale)}. Player cash: ${self.player.cash:,.0f}. Loan: ${self.player.current_loan:,.0f}") # Display loan
        if self.active_events:
             print(f"Active Events: {', '.join([e['name'] + ' (' + str(e['duration_left']) + 'd)' for e in self.active_events])}")

        # Check win/lose conditions after updates
        self.check_win_condition()
        self.check_lose_condition()

    def render(self, screen):
        """Render the game world (if needed - currently handled by UI)."""
        pass

    # --- Helper methods ---
    def get_property_by_id(self, property_id):
        """Find a property (owned or for sale) by its ID."""
        for prop in self.player.properties:
            if prop.id == property_id:
                return prop
        for prop in self.properties_for_sale:
             if prop.id == property_id:
                 return prop
        return None

    def get_upgrade_by_id(self, upgrade_id):
        """Get upgrade data by ID."""
        return self.upgrade_types.get(upgrade_id)