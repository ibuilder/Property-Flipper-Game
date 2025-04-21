# filepath: c:\Users\iphoe\OneDrive\Documents\GitHub\Property-Flipper-Game\game\constants.py
# Screen dimensions
SCREEN_WIDTH = 800
SCREEN_HEIGHT = 600

# Game Title
GAME_TITLE = "Property Flipper Tycoon"

# Colors
COLOR_BACKGROUND = (240, 240, 240) # Light gray
COLOR_TEXT = (0, 0, 0)
COLOR_BUTTON = (180, 180, 180)
COLOR_BUTTON_BORDER = (0, 0, 0)
COLOR_BUTTON_TEXT = (0, 0, 0)
COLOR_SUCCESS = (0, 150, 0)
COLOR_ERROR = (200, 0, 0)
COLOR_INFO = (50, 50, 50)

# Gameplay Constants
STARTING_CASH = 50000
FPS = 60

# --- Game Goal ---
WIN_CONDITION_CASH = 1000000 # Target cash to win

# --- Loan System ---
MAX_LOAN_AMOUNT = 200000 # Maximum loan player can have
LOAN_INTEREST_RATE_DAILY = 0.001 # 0.1% daily interest (approx 3% monthly)
LOAN_INCREMENT = 10000 # Amount to borrow/repay at a time

# --- Holding Costs ---
PROPERTY_TAX_RATE_DAILY = 0.0001 # 0.01% of property value per day (approx 0.3% monthly)

# --- Staff/Contractors ---
CONTRACTOR_DAILY_WAGE = 150       # Cost per day to keep contractor hired
CONTRACTOR_SPEED_MULTIPLIER = 0.7 # Renovations take 70% of the normal time (30% faster)

# --- Player Skills (Initial Bonuses) ---
# Negotiation: Affects buy/sell price slightly. 1.0 = no effect. >1 = better selling, <1 = better buying.
# We'll use a small bonus for now. E.g., 0.01 means 1% better prices.
# NEGOTIATION_SKILL_BONUS = 0.01 # Player gets 1% better sell prices and pays 1% less on buy

# Handiness: Affects renovation cost and speed. 1.0 = no effect. <1 = cheaper/faster.
# HANDINESS_COST_MULTIPLIER = 0.98 # Player pays 2% less for upgrades
# HANDINESS_SPEED_MULTIPLIER = 0.98 # Player renovates 2% faster

# --- Player Skills ---
MAX_SKILL_LEVEL = 10
SKILL_UPGRADE_COST_BASE = 5000
SKILL_UPGRADE_COST_FACTOR = 1.5 # Cost increases by 50% each level (cost = base * factor^level)

# How skills translate to bonuses (per level)
NEGOTIATION_BONUS_PER_LEVEL = 0.005 # 0.5% better buy/sell price per level
HANDINESS_COST_REDUCTION_PER_LEVEL = 0.01 # 1% cheaper upgrades per level
HANDINESS_SPEED_REDUCTION_PER_LEVEL = 0.01 # 1% faster renovations per level
MARKETING_SELL_PRICE_BONUS_PER_LEVEL = 0.004 # 0.4% higher sell price per level (stacks with negotiation)