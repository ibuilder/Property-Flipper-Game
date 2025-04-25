import uuid

class Property:
    def __init__(self, property_id, property_type, location):
        self.property_id = property_id # Unique identifier
        self.property_type = property_type
        self.location = location
        self.condition = 0.5 # Default starting condition
        self.applied_upgrades = [] # List of upgrade dicts applied
        self.renovation_progress = None # Dict like {"upgrade": {...}, "total_days": X, "days_passed": Y} or None

        # Attributes to be set after creation (from GameState._generate_initial_market)
        self.base_value_from_data = 50000 # Default placeholder
        self.base_condition = 0.5 # Default placeholder
        self.location_modifier = 1.0 # Default placeholder

    def calculate_value(self, game_state): # Removed 'market' if not used, check if game_state is needed
        """Calculates the current market value of the property."""
        # Base value from data adjusted by location
        value = self.base_value_from_data * self.location_modifier

        # Adjust value based on current condition (e.g., linear scaling)
        # A property at 1.0 condition might be worth more than base, 0.5 worth base, 0.0 worth much less
        condition_multiplier = 0.2 + (self.condition * 1.6) # Example: 0.2 at 0 cond, 1.0 at 0.5 cond, 1.8 at 1.0 cond
        value *= condition_multiplier

        # Add value from applied upgrades
        upgrade_value_multiplier = 1.0
        for upgrade in self.applied_upgrades:
            upgrade_value_multiplier += upgrade.get('value_increase_percent', 0)
        value *= upgrade_value_multiplier

        # Apply market event modifiers from GameState
        if game_state: # Check if game_state was passed
             # FIX: Use game_state.get_market_modifiers() which doesn't rely on game_time
             event_value_mod, _, _ = game_state.get_market_modifiers()
             value *= event_value_mod
        # else:
             # print("Warning: Calculating property value without game_state (market events).") # Optional warning

        # Ensure value is not negative
        return max(0, int(value))

    def get_state_dict(self):
        """Returns a dictionary representing the property's state."""
        return {
            'property_id': self.property_id,
            'property_type': self.property_type,
            'location': self.location,
            'condition': self.condition,
            'applied_upgrades': self.applied_upgrades, # Assuming upgrade dicts are serializable
            'renovation_progress': self.renovation_progress, # Assuming this dict is serializable
            'base_value_from_data': self.base_value_from_data,
            'base_condition': self.base_condition,
            'location_modifier': self.location_modifier
        }

    @classmethod
    def from_state_dict(cls, state_dict):
        """Creates a Property instance from a state dictionary."""
        # Create instance with required args
        prop = cls(
            property_id=state_dict.get('property_id', str(uuid.uuid4())), # Generate new ID if missing
            property_type=state_dict.get('property_type', 'Unknown Type'),
            location=state_dict.get('location', 'Unknown Location')
        )
        # Set other attributes
        prop.condition = state_dict.get('condition', 0.5)
        prop.applied_upgrades = state_dict.get('applied_upgrades', [])
        prop.renovation_progress = state_dict.get('renovation_progress') # Can be None
        prop.base_value_from_data = state_dict.get('base_value_from_data', 50000)
        prop.base_condition = state_dict.get('base_condition', 0.5)
        prop.location_modifier = state_dict.get('location_modifier', 1.0)
        return prop

    # __str__ and __repr__ methods for easier debugging (optional)
    def __str__(self):
        status = f"Condition: {self.condition:.2f}"
        if self.renovation_progress:
            upgrade_name = self.renovation_progress['upgrade'].get('name', 'N/A')
            days_left = self.renovation_progress['total_days'] - self.renovation_progress['days_passed']
            status = f"Renovating '{upgrade_name}' ({days_left:.1f} days left)"
        return f"ID: {self.property_id[:8]} | Type: {self.property_type} | Loc: {self.location} | Value: ${self.calculate_value(None):,.0f} | Status: {status}" # Pass None for game_state in str

    def __repr__(self):
        return f"Property(id='{self.property_id}', type='{self.property_type}', loc='{self.location}')"