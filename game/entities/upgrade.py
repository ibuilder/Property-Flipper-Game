# This file defines the Upgrade class, which represents an upgrade that can be applied to a property.
class Upgrade:
    def __init__(self, upgrade_id, name, cost, value_increase, condition_increase=0, time_required=1):
        self.id = upgrade_id
        self.name = name
        self.cost = cost
        self.value_increase = value_increase
        self.condition_increase = condition_increase # How much it improves property condition
        self.time_required = time_required # Time units (e.g., days) to complete