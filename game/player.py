import math # Needed for skill cost calculation
from .constants import ( # Import contractor constants
    MAX_LOAN_AMOUNT, LOAN_INCREMENT, LOAN_INTEREST_RATE_DAILY,
    PROPERTY_TAX_RATE_DAILY, CONTRACTOR_DAILY_WAGE, CONTRACTOR_SPEED_MULTIPLIER,
    MAX_SKILL_LEVEL, SKILL_UPGRADE_COST_BASE, SKILL_UPGRADE_COST_FACTOR,
    NEGOTIATION_BONUS_PER_LEVEL, HANDINESS_COST_REDUCTION_PER_LEVEL, HANDINESS_SPEED_REDUCTION_PER_LEVEL,
    MARKETING_SELL_PRICE_BONUS_PER_LEVEL # Import marketing constant
)

class Player:
    def __init__(self, initial_cash=50000):
        self.cash = initial_cash
        self.properties = []  # List of owned Property objects
        self.current_loan = 0 # Amount of loan currently outstanding
        self.has_contractor = False # Track if contractor is hired
        self.game_state_ref = None # Reference to GameState

        # Skill levels
        self.skills = {
            "negotiation": 1,
            "handiness": 1,
            "marketing": 1 # <<< ADD MARKETING SKILL
        }

    # --- Skill Calculation Methods ---
    def get_negotiation_bonus(self):
        """Calculates the current negotiation bonus based on skill level."""
        return self.skills["negotiation"] * NEGOTIATION_BONUS_PER_LEVEL

    def get_handiness_cost_multiplier(self):
        """Calculates the current handiness cost multiplier."""
        # Reduction is capped, e.g., cannot go below 10% cost
        reduction = self.skills["handiness"] * HANDINESS_COST_REDUCTION_PER_LEVEL
        return max(0.1, 1.0 - reduction) # Ensure multiplier doesn't go too low

    def get_handiness_speed_multiplier(self):
        """Calculates the current handiness speed multiplier."""
        # Reduction is capped, e.g., cannot go below 10% time
        reduction = self.skills["handiness"] * HANDINESS_SPEED_REDUCTION_PER_LEVEL
        return max(0.1, 1.0 - reduction) # Ensure multiplier doesn't go too low

    def get_marketing_bonus(self):
        """Calculates the current marketing sell price bonus."""
        return self.skills["marketing"] * MARKETING_SELL_PRICE_BONUS_PER_LEVEL

    def get_skill_upgrade_cost(self, skill_name):
        """Calculates the cost to upgrade a skill to the next level."""
        current_level = self.skills.get(skill_name, 0)
        if current_level >= MAX_SKILL_LEVEL:
            return float('inf') # Cannot upgrade further
        # Cost = base * factor ^ current_level
        cost = int(SKILL_UPGRADE_COST_BASE * (SKILL_UPGRADE_COST_FACTOR ** current_level))
        return cost

    def upgrade_skill(self, skill_name):
        """Attempts to upgrade a skill."""
        if skill_name not in self.skills:
            print(f"Error: Unknown skill '{skill_name}'")
            return False

        current_level = self.skills[skill_name]
        if current_level >= MAX_SKILL_LEVEL:
            print(f"Skill '{skill_name}' is already at max level ({MAX_SKILL_LEVEL}).")
            return False

        cost = self.get_skill_upgrade_cost(skill_name)
        if self.cash < cost:
            print(f"Cannot upgrade '{skill_name}'. Need ${cost:,.0f}, have ${self.cash:,.0f}.")
            return False

        self.cash -= cost
        self.skills[skill_name] += 1
        print(f"Upgraded '{skill_name}' to level {self.skills[skill_name]}! Cost: ${cost:,.0f}.")
        return True

    def buy_property(self, prop, market):
        """Buys a property from the market."""
        if prop not in market.properties_for_sale:
            print(f"Error: Property {prop.id} not found in market.")
            return False

        # Calculate actual asking price (considering market value and negotiation skill)
        base_asking_price = prop.calculate_value(market, self.game_state_ref) # Assuming game_state_ref is set
        # Apply negotiation skill bonus
        negotiation_bonus = self.get_negotiation_bonus()
        negotiated_price = int(base_asking_price * (1.0 - negotiation_bonus))

        if self.cash < negotiated_price:
            print(f"Error: Cannot afford property {prop.id}. Need ${negotiated_price:,.0f}, have ${self.cash:,.0f}.")
            return False

        self.cash -= negotiated_price
        self.properties.append(prop)
        market.properties_for_sale.remove(prop)
        print(f"Bought property {prop.id} for ${negotiated_price:,.0f} (Nego Lvl {self.skills['negotiation']}). Base price was ${base_asking_price:,.0f}.")
        return True

    def sell_property(self, prop, market):
        """Sells a property back to the market (simplified)."""
        if prop not in self.properties:
            print(f"Error: Property {prop.id} not owned by player.")
            return False
        if prop.renovation_progress:
            print(f"Error: Cannot sell property {prop.id} during renovation.")
            return False

        # Calculate actual selling price (considering market value and negotiation skill)
        base_market_value = prop.calculate_value(market, self.game_state_ref) # Assuming game_state_ref is set
        # Apply negotiation skill bonus
        negotiation_bonus = self.get_negotiation_bonus()
        # Apply marketing skill bonus
        marketing_bonus = self.get_marketing_bonus()

        # Combine bonuses (additively for simplicity)
        total_bonus = negotiation_bonus + marketing_bonus
        negotiated_price = int(base_market_value * (1.0 + total_bonus))

        self.cash += negotiated_price
        self.properties.remove(prop)
        # For simplicity, property just disappears. Could add back to market later.
        print(f"Sold property {prop.id} for ${negotiated_price:,.0f} (Nego Lvl {self.skills['negotiation']}, Mark Lvl {self.skills['marketing']}). Base value was ${base_market_value:,.0f}.")
        # Trigger market refresh potentially?
        # market.request_market_refresh() # If such a method exists
        return True

    def start_property_renovation(self, prop, upgrade, game_state):
        if prop not in self.properties:
            print("Error: Cannot renovate property not owned by player.")
            return False
        if prop.renovation_progress:
            print(f"Error: Property {prop.id} is already under renovation.")
            return False
        if upgrade.id in [up.id for up in prop.upgrades]:
             print(f"Error: Upgrade '{upgrade.name}' already applied to property {prop.id}.")
             return False

        # Calculate actual cost (consider event modifiers AND handiness skill)
        cost_modifier_event = game_state.get_active_event_modifier(prop.location, "upgrade_cost_multiplier")
        base_cost = upgrade.cost * cost_modifier_event
        handiness_cost_mult = self.get_handiness_cost_multiplier() # Get current multiplier
        actual_cost = int(base_cost * handiness_cost_mult)

        if self.cash < actual_cost:
            print(f"Error: Cannot afford upgrade '{upgrade.name}'. Need ${actual_cost:,.0f}, have ${self.cash:,.0f}.")
            return False

        # Calculate actual time (consider event modifiers, contractor, AND handiness skill)
        time_modifier_event = game_state.get_active_event_modifier(prop.location, "renovation_time_multiplier")
        base_time_required = upgrade.time_required * time_modifier_event

        # Apply contractor speed bonus first
        if self.has_contractor:
            time_after_contractor = base_time_required * CONTRACTOR_SPEED_MULTIPLIER
        else:
            time_after_contractor = base_time_required

        handiness_speed_mult = self.get_handiness_speed_multiplier() # Get current multiplier
        actual_time_required = time_after_contractor * handiness_speed_mult

        # Deduct cash and start renovation
        self.cash -= actual_cost
        prop.start_renovation(upgrade, actual_time_required)
        print(f"Started renovation '{upgrade.name}' on {prop.id}. Cost: ${actual_cost:,.0f} (Handi Lvl {self.skills['handiness']}). Time: {actual_time_required:.1f} days.")
        return True

    def take_loan(self, amount):
        """Takes out a loan, increasing cash and loan amount."""
        if amount <= 0:
            print("Loan amount must be positive.")
            return False
        if self.current_loan + amount > MAX_LOAN_AMOUNT:
            print(f"Cannot borrow more. Max loan is ${MAX_LOAN_AMOUNT:,.0f}. Current loan: ${self.current_loan:,.0f}")
            return False

        self.current_loan += amount
        self.cash += amount
        print(f"Borrowed ${amount:,.0f}. Current loan: ${self.current_loan:,.0f}. Cash: ${self.cash:,.0f}")
        return True

    def repay_loan(self, amount):
        """Repays part or all of the loan, decreasing cash and loan amount."""
        if amount <= 0:
            print("Repayment amount must be positive.")
            return False

        repayment = min(amount, self.current_loan) # Cannot repay more than the loan amount
        if repayment > self.cash:
            print(f"Cannot repay ${repayment:,.0f}. Insufficient cash: ${self.cash:,.0f}")
            return False

        self.current_loan -= repayment
        self.cash -= repayment
        print(f"Repaid ${repayment:,.0f}. Remaining loan: ${self.current_loan:,.0f}. Cash: ${self.cash:,.0f}")
        return True

    def apply_interest(self):
        """Calculates and deducts daily interest from cash."""
        if self.current_loan > 0:
            interest_due = int(self.current_loan * LOAN_INTEREST_RATE_DAILY)
            if interest_due > 0: # Only apply if interest is at least $1
                self.cash -= interest_due
                # print(f"Paid ${interest_due} in loan interest. Cash: ${self.cash:,.0f}") # Optional: Can be noisy
                return interest_due
        return 0

    def apply_taxes(self, market, game_state):
        """Calculates and deducts daily property taxes based on current value."""
        total_tax_due = 0
        if not self.properties:
            return 0

        for prop in self.properties:
            # Calculate value *once* per day for tax purposes
            current_value = prop.calculate_value(market, game_state)
            daily_tax = int(current_value * PROPERTY_TAX_RATE_DAILY)
            total_tax_due += daily_tax

        if total_tax_due > 0:
            self.cash -= total_tax_due
            # print(f"Paid ${total_tax_due} in property taxes.") # Optional: Can be noisy
        return total_tax_due

    def hire_contractor(self):
        """Hires the contractor."""
        if self.has_contractor:
            print("Contractor already hired.")
            return False
        # Simple version: no upfront cost, just start paying daily wage
        self.has_contractor = True
        print(f"Contractor hired. Daily wage: ${CONTRACTOR_DAILY_WAGE:,.0f}. Renovation speed increased.")
        return True

    def fire_contractor(self):
        """Fires the contractor."""
        if not self.has_contractor:
            print("Contractor not currently hired.")
            return False
        self.has_contractor = False
        print("Contractor fired.")
        return True

    def apply_wages(self):
        """Deducts daily wages for hired staff."""
        total_wages = 0
        if self.has_contractor:
            total_wages += CONTRACTOR_DAILY_WAGE
            self.cash -= CONTRACTOR_DAILY_WAGE
        return total_wages

    def update(self, days_passed, market, game_state): # <<< ADD game_state parameter
        """Update player-owned properties, apply interest, taxes, and wages."""
        total_interest_paid = 0
        total_taxes_paid = 0
        total_wages_paid = 0 # Track wages
        for _ in range(days_passed): # Apply costs daily
            # Apply interest first
            total_interest_paid += self.apply_interest()
            # Apply property taxes
            total_taxes_paid += self.apply_taxes(market, game_state) # <<< CALL apply_taxes
            # Apply contractor wages <<< NEW
            total_wages_paid += self.apply_wages()

            # Update renovations for one day
            for prop in self.properties:
                prop.update_renovation(1)

        if total_interest_paid > 0:
             print(f"Paid ${total_interest_paid:,.0f} in loan interest over {days_passed} day(s).")
        if total_taxes_paid > 0:
             print(f"Paid ${total_taxes_paid:,.0f} in property taxes over {days_passed} day(s).") # <<< Log taxes paid
        if total_wages_paid > 0: # <<< Log wages paid
             print(f"Paid ${total_wages_paid:,.0f} in contractor wages over {days_passed} day(s).")

    # Add game_state_ref to player if needed for buy/sell property value calculation
    def link_game_state(self, game_state):
         self.game_state_ref = game_state