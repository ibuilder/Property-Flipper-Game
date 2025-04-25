import pygame
import os # <<< Import os module

# --- Screen ---
SCREEN_WIDTH = 800
SCREEN_HEIGHT = 600
GAME_TITLE = "Property Flipper"
FPS = 60

# --- Colors ---
COLOR_BACKGROUND = (240, 240, 240)
COLOR_TEXT = (10, 10, 10)
COLOR_BUTTON = (200, 200, 200)
COLOR_BUTTON_BORDER = (150, 150, 150)
COLOR_BUTTON_TEXT = (0, 0, 0)
COLOR_BUTTON_HOVER = (220, 220, 220)
COLOR_SUCCESS = (0, 150, 0)
COLOR_ERROR = (200, 0, 0)
COLOR_INFO = (0, 0, 150)
COLOR_PROPERTY_GOOD = (0, 180, 0)
COLOR_PROPERTY_MEDIUM = (200, 180, 0)
COLOR_PROPERTY_POOR = (180, 0, 0)
COLOR_RENOVATING = (0, 100, 200)

# --- Game Logic ---
STARTING_CASH = 50000
WIN_CONDITION_CASH = 1000000 # Example win condition
LOAN_INCREMENT = 10000
MAX_LOAN_AMOUNT = 100000
LOAN_INTEREST_RATE_DAILY = 0.001 # 0.1% daily interest
PROPERTY_TAX_RATE_DAILY = 0.0005 # 0.05% of property value per day
CONTRACTOR_DAILY_WAGE = 200
CONTRACTOR_SPEED_MULTIPLIER = 2.0 # Renovations are twice as fast

# --- Skills ---
MAX_SKILL_LEVEL = 10
SKILL_UPGRADE_COST_BASE = 5000
SKILL_UPGRADE_COST_FACTOR = 1.5 # Cost multiplier per level

# How skills translate to bonuses (per level)
NEGOTIATION_BONUS_PER_LEVEL = 0.005 # 0.5% better buy/sell price per level
HANDINESS_COST_REDUCTION_PER_LEVEL = 0.01 # 1% cheaper upgrades per level
HANDINESS_SPEED_REDUCTION_PER_LEVEL = 0.01 # 1% faster renovations per level
MARKETING_SELL_PRICE_BONUS_PER_LEVEL = 0.004 # 0.4% higher sell price per level (stacks with negotiation)

# Skill effect caps
MIN_HANDINESS_COST_MULTIPLIER = 0.1 # Minimum cost multiplier (e.g., 10% of base cost)
MIN_HANDINESS_SPEED_MULTIPLIER = 0.1 # Minimum speed multiplier (e.g., 10% of base time)

# --- File Paths ---
DATA_DIR = "data"
SAVE_DIR = "saves"
SOUND_DIR = "assets/sounds" # <<< DEFINE SOUND DIRECTORY PATH

# --- Sound Effects ---
# Define filenames for sounds (relative to SOUND_DIR)
SOUND_CLICK = "click.wav"
SOUND_BUY_SELL = "buy_sell.wav"
SOUND_UPGRADE = "upgrade.wav"
SOUND_ERROR = "error.wav"
SOUND_WIN = "win.wav"
SOUND_LOSE = "lose.wav"

# --- Market Events ---
EVENT_DURATION_DAYS = 30 # How long events last
EVENT_CHANCE_PER_DAY = 0.05 # 5% chance of an event starting each day