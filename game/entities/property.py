class Property:
    def __init__(self, property_id, property_type, location, condition=50):
        self.id = property_id
        self.type = property_type  # Reference to property type data (loaded from JSON)
        self.location = location  # Location data (string key like "downtown")
        self.condition = condition  # 0-100 scale
        self.upgrades = []  # List of applied Upgrade objects
        self.renovation_progress = None # Tracks ongoing renovation { 'upgrade': upgrade_obj, 'time_left': time }

    def calculate_value(self, market, game_state): # <<< ADD game_state parameter
        """Calculates the current market value of the property."""
        base_value = self.type.get("base_value", 0)

        # Condition multiplier (e.g., 0.5 at 0 condition to 1.0 at 100 condition)
        condition_multiplier = 0.5 + (self.condition / 200.0)

        # Location multiplier (fetch current multiplier considering events)
        location_multiplier = market.get_current_multiplier(self.location, game_state) # <<< USE NEW METHOD

        # Upgrade value
        upgrade_value = sum(up.value_increase for up in self.upgrades)

        # Combine factors
        # Simple model: (Base * Condition * Location) + UpgradeValue
        value = (base_value * condition_multiplier * location_multiplier) + upgrade_value

        # Apply global market event modifiers? (Could be done here or in market multiplier)
        # global_event_modifier = game_state.get_active_event_modifier('all', 'value_multiplier')
        # value *= global_event_modifier

        return int(value) # Return integer value

    def start_renovation(self, upgrade):
        """Begin applying an upgrade."""
        # Check if max upgrades reached (requires type data)
        if isinstance(self.type, dict) and len(self.upgrades) >= self.type.get("max_upgrades", 99):
             print(f"Cannot add more upgrades to property {self.id}. Max reached.")
             return False
        if self.renovation_progress is None:
            self.renovation_progress = {'upgrade': upgrade, 'time_left': upgrade.time_required}
            print(f"Started renovation '{upgrade.name}' on property {self.id}.")
            return True
        else:
            print(f"Property {self.id} is already undergoing renovation.")
            return False

    def update_renovation(self, days_passed):
        """Update ongoing renovation progress based on days passed."""
        if self.renovation_progress:
            self.renovation_progress['time_left'] -= days_passed # Decrease time left by days passed
            if self.renovation_progress['time_left'] <= 0:
                self.complete_renovation()

    def complete_renovation(self):
        """Finalize the renovation."""
        if self.renovation_progress:
            completed_upgrade = self.renovation_progress['upgrade']
            self.upgrades.append(completed_upgrade)
            self.condition = min(100, self.condition + completed_upgrade.condition_increase)
            print(f"Completed renovation '{completed_upgrade.name}' on property {self.id}. Condition: {self.condition}")
            self.renovation_progress = None