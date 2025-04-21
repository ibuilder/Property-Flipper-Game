house-flipper/
├── main.py                    # Main entry point
├── game/
│   ├── __init__.py            # Package initialization
│   ├── game_state.py          # Core game state management
│   ├── constants.py           # Game constants
│   ├── player.py              # Player class
│   ├── market.py              # Market simulation
│   ├── ui/
│   │   ├── __init__.py
│   │   ├── ui_manager.py      # UI management system
│   │   ├── main_menu.py       # Main menu screen
│   │   ├── property_view.py    # Property viewing screen
│   │   ├── market_view.py     # Market browsing screen
│   │   ├── upgrades_view.py   # Upgrades screen
│   │   ├── objectives_view.py  # Objectives screen
│   ├── entities/
│   │   ├── __init__.py
│   │   ├── property.py        # Property class
│   │   ├── upgrade.py         # Upgrade class
│   │   ├── market_event.py    # Market event class
│   ├── utils/
│   │   ├── __init__.py
│   │   ├── file_handlers.py    # Save/load handling
│   │   ├── calculations.py     # Value calculations
├── assets/
│   ├── images/                # Image assets
│   ├── fonts/                 # Font files
├── data/
│   ├── properties.json        # Property types data
│   ├── upgrades.json          # Upgrade types data
│   ├── market_events.json     # Market events data
│   ├── locations.json         # Location data
│   ├── levels.json            # Level and objective data
└── saves/                     # Save game files