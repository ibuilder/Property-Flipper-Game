class Market:
    def __init__(self, locations_data=None):
        self._base_location_multipliers = {} # Store the original multipliers
        if locations_data:
             self._base_location_multipliers = {loc_id: data.get("multiplier", 1.0)
                                          for loc_id, data in locations_data.items()}
        else:
            # Default values if locations.json is missing/empty
            self._base_location_multipliers = {
                "downtown": 1.2, "suburbs": 1.0, "rural": 0.7, "beachfront": 1.5
            }
        # Current multipliers can be calculated on the fly or stored if needed
        # self._current_location_multipliers = self._base_location_multipliers.copy()
        print(f"Market initialized with base multipliers: {self._base_location_multipliers}")

    def get_location_multiplier(self, location_id):
         """DEPRECATED: Use get_current_multiplier instead."""
         print("Warning: get_location_multiplier is deprecated. Use get_current_multiplier.")
         return self._base_location_multipliers.get(location_id, 1.0)

    def get_current_multiplier(self, location_id, game_state):
        """Get the current value multiplier for a location, considering active events."""
        base_multiplier = self._base_location_multipliers.get(location_id, 1.0)
        event_modifier = game_state.get_active_event_modifier(location_id, "value_multiplier")
        # Combine base and event modifiers (multiplicative)
        current_multiplier = base_multiplier * event_modifier
        # print(f"Multiplier for {location_id}: Base={base_multiplier}, EventMod={event_modifier}, Current={current_multiplier}") # Debug print
        return current_multiplier

    def reset_multipliers(self):
        """Called when events change to signal potential multiplier updates.
           Currently does nothing as multipliers are calculated on demand,
           but could be used if caching current multipliers."""
        # print("Market multipliers potentially updated due to event change.")
        pass

    # Placeholder for future market dynamics (e.g., supply/demand adjustments)
    # def update(self, dt, active_events):
    #     pass
