from .constants import CONTRACTOR_DAILY_WAGE, CONTRACTOR_SPEED_MULTIPLIER

class Player:
    def __init__(self, starting_cash):
        self.cash = starting_cash
        self.properties = [] # List of Property objects owned by the player
        self.loan_amount = 0
        self.skills = {
            "negotiation": 0,
            "handiness": 0,
            "marketing": 0
        }
        self.has_contractor = False
        self.game_state = None # Link to GameState set later

    def link_game_state(self, game_state):
        """Link the player to the main game state."""
        self.game_state = game_state

    # --- Property Methods ---
    def buy_property(self, property_obj, market):
        """Buys a property from the market."""
        if property_obj not in market.properties_for_sale:
            return False, "Property not for sale."

        # Calculate price after negotiation
        base_price = property_obj.calculate_value(market, self.game_state)
        negotiation_bonus = self.get_negotiation_bonus()
        final_price = int(base_price * negotiation_bonus)

        if self.cash < final_price:
            return False, "Not enough cash to buy this property."

        # Purchase the property
        self.cash -= final_price
        self.properties.append(property_obj)
        market.properties_for_sale.remove(property_obj)
        return True, f"Property {property_obj.property_id} purchased."

    def sell_property(self, property_obj, market):
        """Sells a property back to the market."""
        if property_obj not in self.properties:
            return False, "Property not owned."

        # Calculate selling price with marketing bonus
        base_value = property_obj.calculate_value(market, self.game_state)
        marketing_bonus = self.get_marketing_bonus()
        selling_price = int(base_value * marketing_bonus)

        # Sell the property
        self.cash += selling_price
        self.properties.remove(property_obj)
        market.properties_for_sale.append(property_obj) # Assuming properties_for_sale is a list in market
        return True, f"Property {property_obj.property_id} sold."

    def start_property_renovation(self, property_obj, upgrade_data, cost, time_days):
        """Starts a renovation on a specific property."""
        if property_obj not in self.properties:
            print("Error: Cannot renovate property not owned by player.")
            return False
        if property_obj.renovation_progress is not None:
            print(f"Error: Property {property_obj.property_id} is already undergoing renovation.")
            return False
        if self.cash < cost:
            print(f"Error: Insufficient funds to start renovation (Need ${cost:,.0f}).")
            return False

        # Deduct cost and start renovation
        self.cash -= cost
        property_obj.renovation_progress = {
            "upgrade": upgrade_data,
            "total_days": time_days,
            "days_passed": 0
        }
        print(f"Started renovation '{upgrade_data.get('name')}' on property {property_obj.property_id}. Cost: ${cost:,.0f}, Time: {time_days} days.")
        return True

    # --- Loan Methods ---
    def take_loan(self, amount):
        """Takes out a loan, increasing cash and loan amount."""
        if amount <= 0:
            return False, "Loan amount must be positive."
        if self.loan_amount + amount > MAX_LOAN_AMOUNT:
            return False, "Loan amount exceeds maximum limit."

        self.loan_amount += amount
        self.cash += amount
        return True, f"Loan of ${amount:,.0f} taken. Total loan: ${self.loan_amount:,.0f}"

    def repay_loan(self, amount):
        """Repays part or all of the loan, decreasing cash and loan amount."""
        if amount <= 0:
            return False, "Repayment amount must be positive."

        repayment = min(amount, self.loan_amount) # Cannot repay more than the loan amount
        if repayment > self.cash:
            return False, "Insufficient cash for repayment."

        self.loan_amount -= repayment
        self.cash -= repayment
        return True, f"Repaid ${repayment:,.0f}. Remaining loan: ${self.loan_amount:,.0f}. Cash: ${self.cash:,.0f}"

    # --- Skill Methods ---
    def get_skill_upgrade_cost(self, skill_name):
        """Calculates the cost to upgrade a skill."""
        current_level = self.skills.get(skill_name, 0)
        if current_level >= MAX_SKILL_LEVEL:
            return None # Max level reached
        cost = SKILL_UPGRADE_COST_BASE * (SKILL_UPGRADE_COST_FACTOR ** current_level)
        return int(cost)

    def upgrade_skill(self, skill_name):
        """Upgrades a player skill if possible."""
        if skill_name not in self.skills:
            return False, "Invalid skill name."

        current_level = self.skills.get(skill_name, 0)
        if current_level >= MAX_SKILL_LEVEL:
            return False, f"{skill_name.capitalize()} skill is already at max level ({MAX_SKILL_LEVEL})."

        cost = self.get_skill_upgrade_cost(skill_name)
        if cost is None: # Should not happen if level check is done, but good practice
             return False, f"{skill_name.capitalize()} skill is already at max level."

        if self.cash >= cost:
            self.cash -= cost
            self.skills[skill_name] += 1
            new_level = self.skills[skill_name]
            # Play sound via game_state if linked
            if self.game_state and hasattr(self.game_state, 'sound_manager'):
                 self.game_state.sound_manager.play("upgrade") # Assuming sound_manager is accessible
            return True, f"{skill_name.capitalize()} skill upgraded to level {new_level}! Cost: ${cost:,.0f}"
        else:
            # Play sound via game_state if linked
            if self.game_state and hasattr(self.game_state, 'sound_manager'):
                 self.game_state.sound_manager.play("error")
            return False, f"Insufficient funds to upgrade {skill_name}. Need ${cost:,.0f}."

    def get_negotiation_bonus(self):
        """Returns the negotiation bonus multiplier (e.g., 0.95 for 5% discount)."""
        level = self.skills.get("negotiation", 0)
        return 1.0 - (level * NEGOTIATION_BONUS_PER_LEVEL) # Lower multiplier is better for buying

    def get_marketing_bonus(self):
        """Returns the marketing bonus multiplier (e.g., 1.05 for 5% price increase)."""
        level = self.skills.get("marketing", 0)
        return 1.0 + (level * MARKETING_SELL_PRICE_BONUS_PER_LEVEL) # Higher multiplier is better for selling

    def get_renovation_multipliers(self):
        """Returns cost and time multipliers for renovations based on handiness."""
        level = self.skills.get("handiness", 0)
        cost_reduction = level * HANDINESS_COST_REDUCTION_PER_LEVEL
        time_reduction = level * HANDINESS_SPEED_REDUCTION_PER_LEVEL

        cost_multiplier = max(MIN_HANDINESS_COST_MULTIPLIER, 1.0 - cost_reduction)
        time_multiplier = max(MIN_HANDINESS_SPEED_MULTIPLIER, 1.0 - time_reduction)

        # Factor in market events affecting costs/time
        if self.game_state:
            _, event_cost_mod, event_time_mod = self.game_state.get_market_modifiers()
            cost_multiplier *= event_cost_mod
            time_multiplier *= event_time_mod

        return cost_multiplier, time_multiplier


    # --- Save/Load ---
    def get_state_dict(self):
        """Returns a dictionary representing the player's state."""
        return {
            'cash': self.cash,
            'properties': [prop.get_state_dict() for prop in self.properties],
            'loan_amount': self.loan_amount,
            'skills': self.skills.copy(),
            'has_contractor': self.has_contractor
        }

    def load_state_dict(self, state_dict):
        """Loads the player's state from a dictionary."""
        self.cash = state_dict.get('cash', 0)
        # Need Property.from_state_dict method
        self.properties = [Property.from_state_dict(p_dict) for p_dict in state_dict.get('properties', [])]
        self.loan_amount = state_dict.get('loan_amount', 0)
        self.skills = state_dict.get('skills', {"negotiation": 0, "handiness": 0, "marketing": 0})
        self.has_contractor = state_dict.get('has_contractor', False)
        # Note: game_state link needs to be re-established after loading GameState