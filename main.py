import pygame
import sys
from game.constants import *
from game.game_state import GameState
from game.ui.ui_manager import UIManager
from game.utils.sound_manager import sound_manager # <<< Import sound manager instance

def main():
    pygame.init()
    screen = pygame.display.set_mode((SCREEN_WIDTH, SCREEN_HEIGHT))
    pygame.display.set_caption(GAME_TITLE)
    clock = pygame.time.Clock()

    # --- Load Sounds ---
    sound_manager.load_sound("click", SOUND_CLICK)
    sound_manager.load_sound("buy_sell", SOUND_BUY_SELL)
    sound_manager.load_sound("upgrade", SOUND_UPGRADE)
    sound_manager.load_sound("error", SOUND_ERROR)
    sound_manager.load_sound("win", SOUND_WIN)
    sound_manager.load_sound("lose", SOUND_LOSE)
    # --- End Load Sounds ---

    game_state = GameState()
    ui_manager = UIManager(screen, game_state)

    running = True
    while running:
        dt = clock.tick(FPS) / 1000.0 # Delta time in seconds

        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                running = False
            ui_manager.handle_event(event) # Pass event to UI manager

        # Update game state (if needed, e.g., for animations, timed events)
        ui_manager.update(dt) # Update UI elements (like feedback timers)
        # game_state.update(dt) # Currently only checks win/loss, called less often now

        # Render
        screen.fill(COLOR_BACKGROUND) # Clear screen
        ui_manager.render() # Render current view
        pygame.display.flip() # Update the display

    pygame.quit()
    sys.exit()

if __name__ == '__main__':
    # Create dummy data files if they don't exist for testing
    import os
    import json
    data_dir = 'data'
    if not os.path.exists(data_dir):
        os.makedirs(data_dir)
    dummy_files = {
        'properties.json': {
            "starter_home": {"name": "Starter Home", "base_value": 80000, "size": 1, "max_upgrades": 4},
            "suburban_house": {"name": "Suburban House", "base_value": 150000, "size": 2, "max_upgrades": 6},
            "fixer_upper": {"name": "Fixer Upper", "base_value": 60000, "size": 1, "max_upgrades": 5}, # Cheaper, needs work
            "small_condo": {"name": "Small Condo", "base_value": 110000, "size": 1, "max_upgrades": 3}, # Less upgrade potential
            "luxury_apt": {"name": "Luxury Apartment", "base_value": 250000, "size": 2, "max_upgrades": 7} # More expensive
        },
        'upgrades.json': {
            "basic_paint": {"name": "Basic Paint Job", "cost": 500, "value_increase": 2000, "condition_increase": 5, "time_required": 1},
            "new_kitchen": {"name": "New Kitchen", "cost": 15000, "value_increase": 25000, "condition_increase": 10, "time_required": 5},
            "landscaping": {"name": "Landscaping", "cost": 2000, "value_increase": 5000, "condition_increase": 3, "time_required": 2},
            "bathroom_reno": {"name": "Bathroom Reno", "cost": 8000, "value_increase": 12000, "condition_increase": 8, "time_required": 4},
            "roof_repair": {"name": "Roof Repair", "cost": 5000, "value_increase": 3000, "condition_increase": 15, "time_required": 3}, # High condition boost
            "hardwood_floors": {"name": "Hardwood Floors", "cost": 7000, "value_increase": 10000, "condition_increase": 5, "time_required": 4}
        },
        'locations.json': {
            "downtown": {"name": "Downtown", "multiplier": 1.2},
            "suburbs": {"name": "Suburbs", "multiplier": 1.0},
            "rural": {"name": "Rural", "multiplier": 0.7},
            "beachfront": {"name": "Beachfront", "multiplier": 1.5}, # New desirable location
            "industrial": {"name": "Industrial Zone", "multiplier": 0.6} # New less desirable location
        },
        'market_events.json': {
            "housing_boom": {"name": "Housing Boom", "duration": 30, "effects": [{"type": "value_multiplier", "location": "all", "amount": 1.1}]},
            "construction_delay": {"name": "Construction Delay", "duration": 20, "effects": [{"type": "renovation_time_multiplier", "location": "all", "amount": 1.5}]},
            "skilled_labor_shortage": {"name": "Labor Shortage", "duration": 25, "effects": [{"type": "renovation_time_multiplier", "location": "all", "amount": 1.2}, {"type": "upgrade_cost_multiplier", "location": "all", "amount": 1.1}]},
            "recession": {"name": "Recession", "duration": 45, "effects": [{"type": "value_multiplier", "location": "all", "amount": 0.85}]}, # Market downturn
            "beach_tourism_surge": {"name": "Beach Tourism Surge", "duration": 20, "effects": [{"type": "value_multiplier", "location": "beachfront", "amount": 1.25}]}, # Location specific event
            "material_shortage": {"name": "Material Shortage", "duration": 15, "effects": [{"type": "upgrade_cost_multiplier", "location": "all", "amount": 1.3}]} # Affects upgrade costs
        }
    }
    for filename, content in dummy_files.items():
        filepath = os.path.join(data_dir, filename)
        if not os.path.exists(filepath):
            try:
                with open(filepath, 'w') as f:
                    json.dump(content, f, indent=2)
                print(f"Created dummy data file: {filepath}")
            except Exception as e:
                 print(f"Error creating dummy file {filepath}: {e}")
        else:
             print(f"Data file already exists: {filepath} (Skipping creation)")

    main()
