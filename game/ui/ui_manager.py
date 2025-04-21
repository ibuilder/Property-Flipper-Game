# filepath: c:\Users\iphoe\OneDrive\Documents\GitHub\Property-Flipper-Game\game\ui\ui_manager.py
import pygame
from .main_menu import MainMenu
from .market_view import MarketView
from .portfolio_view import PortfolioView
from .start_renovation_view import StartRenovationView # <<< RENAMED IMPORT
from .upgrades_list_view import UpgradesListView # <<< NEW IMPORT
from .market_status_view import MarketStatusView # <<< NEW IMPORT
from .win_screen import WinScreen # <<< NEW IMPORT
from .game_over_screen import GameOverScreen # <<< NEW IMPORT

class UIManager:
    def __init__(self, screen, game_state):
        self.screen = screen
        self.game_state = game_state

        # Instantiate different UI views/screens
        self.views = {
            "main_menu": MainMenu(game_state),
            "market_view": MarketView(game_state),
            "portfolio_view": PortfolioView(game_state),
            "start_renovation_view": StartRenovationView(game_state), # <<< RENAMED KEY/CLASS
            "upgrades_list_view": UpgradesListView(game_state), # <<< NEW VIEW
            "market_status_view": MarketStatusView(game_state), # <<< NEW VIEW INSTANCE
            "win_screen": WinScreen(game_state), # <<< NEW VIEW INSTANCE
            "game_over_screen": GameOverScreen(game_state), # <<< NEW VIEW INSTANCE
        }
        # Add placeholder views for buttons that don't have a class yet
        # This prevents errors if a button is clicked before its view is implemented
        # We can create a simple placeholder class or just handle it in render/handle_event

    def handle_event(self, event):
        """Passes the event to the currently active view."""
        current_view_name = self.game_state.current_view
        if current_view_name in self.views:
            view = self.views[current_view_name]
            if hasattr(view, 'handle_input'): # Check if the view has an input handler
                view.handle_input(event)
        # else: Handle cases where the view isn't implemented yet? Maybe log a warning.
        #     print(f"Warning: No view implemented for '{current_view_name}' to handle event.")


    def render(self):
        """Renders the currently active UI view."""
        current_view_name = self.game_state.current_view
        if current_view_name in self.views:
            view = self.views[current_view_name]
            if hasattr(view, 'render'): # Check if the view has a render method
                 view.render(self.screen)
        else:
            # Optionally, render a placeholder "Not Implemented" screen
            font = pygame.font.SysFont(None, 48)
            text_surf = font.render(f"'{current_view_name}' - Not Implemented", True, (255, 0, 0))
            text_rect = text_surf.get_rect(center=(self.screen.get_width() // 2, self.screen.get_height() // 2))
            self.screen.blit(text_surf, text_rect)
            # Add a way to return to main menu, e.g., pressing ESC
            # Or render a simple "Back" button

    def update(self, dt): # <<< UNCOMMENT/ADD THIS METHOD
        """Updates the current view if needed (e.g., animations, timers)."""
        current_view_name = self.game_state.current_view
        if current_view_name in self.views:
            view = self.views[current_view_name]
            if hasattr(view, 'update'): # Check if view has an update method
                view.update(dt)
