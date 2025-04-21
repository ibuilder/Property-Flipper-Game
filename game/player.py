from .constants import MAX_LOAN_AMOUNT, LOAN_INCREMENT, LOAN_INTEREST_RATE_DAILY # Import loan constants

class Player:
    def __init__(self, initial_cash=50000):
        self.cash = initial_cash
        self.properties = []  # List of owned Property objects
        self.current_loan = 0 # Amount of loan currently outstanding

    def buy_property(self, property_obj, market):
        """Attempt to buy a property."""
        cost = property_obj.calculate_value(market)
        if self.cash >= cost:
            self.cash -= cost
            self.properties.append(property_obj)
            print(f"Player bought property {property_obj.id} for ${cost}")
            return True
        else:
            print(f"Player cannot afford property {property_obj.id}. Needs ${cost}, has ${self.cash}")
            return False

    def sell_property(self, prop, market, game_state): # <<< ADD game_state
        """Sell an owned property."""
        if prop not in self.properties:
            print("Error: Cannot sell property not owned by player.")
            return False
        if prop.renovation_progress:
            print(f"Error: Cannot sell property {prop.id} while under renovation.")
            return False

        sale_price = prop.calculate_value(market, game_state) # <<< PASS game_state
        self.cash += sale_price
        self.properties.remove(prop)
        # Add property back to market for sale? Optional.
        # game_state.properties_for_sale.append(prop)
        print(f"Sold {prop.type.get('name', 'property')} ({prop.id}) for ${sale_price:,.0f}")
        return True

    def start_property_renovation(self, prop, upgrade, game_state): # <<< ADD game_state
        if prop not in self.properties:
            print("Error: Cannot renovate property not owned by player.")
            return False
        if prop.renovation_progress:
            print(f"Error: Property {prop.id} is already under renovation.")
            return False
        if upgrade.id in [up.id for up in prop.upgrades]:
             print(f"Error: Upgrade '{upgrade.name}' already applied to property {prop.id}.")
             return False

        # Check affordability (consider cost modifiers from events)
        cost_modifier = game_state.get_active_event_modifier(prop.location, "upgrade_cost_multiplier")
        actual_cost = int(upgrade.cost * cost_modifier)

        if self.cash < actual_cost:
            print(f"Error: Cannot afford upgrade '{upgrade.name}'. Need ${actual_cost:,.0f}, have ${self.cash:,.0f}.")
            return False

        # Check time (apply time modifiers from events)
        time_modifier = game_state.get_active_event_modifier(prop.location, "renovation_time_multiplier")
        actual_time_required = upgrade.time_required * time_modifier

        # Deduct cash and start renovation
        self.cash -= actual_cost
        prop.start_renovation(upgrade, actual_time_required) # Pass modified time
        print(f"Started renovation '{upgrade.name}' on {prop.id}. Cost: ${actual_cost:,.0f}. Time: {actual_time_required:.1f} days.")
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

    def update(self, days_passed, market):
        """Update player-owned properties and apply interest."""
        total_interest_paid = 0
        for _ in range(days_passed): # Apply interest daily
            total_interest_paid += self.apply_interest()
            # Update renovations for one day
            for prop in self.properties:
                prop.update_renovation(1) # Pass 1 day for renovation update

        if total_interest_paid > 0:
             print(f"Paid ${total_interest_paid:,.0f} in loan interest over {days_passed} day(s).")

        # Note: Renovation updates are now handled within the daily loop above
        # for prop in self.properties:
        #    prop.update_renovation(days_passed) # Remove this duplicate update