# filepath: c:\Users\iphoe\OneDrive\Documents\GitHub\Property-Flipper-Game\game\ui\main_menu.py
import pygame
from ..constants import * # Import all constants including loan related
from ..utils.file_handlers import save_game, load_game

class MainMenu:
    def __init__(self, game_state):
        self.game_state = game_state
        self.font_title = pygame.font.SysFont(None, 72)
        self.font_info = pygame.font.SysFont(None, 36)
        self.font_button = pygame.font.SysFont(None, 48)
        self.font_day_button = pygame.font.SysFont(None, 40) # Font for Next Day
        self.font_feedback = pygame.font.SysFont(None, 30) # For save/load messages
        self.font_event = pygame.font.SysFont(None, 28) # Font for events
        self.feedback_message = ""
        self.feedback_timer = 0
        self.feedback_color = COLOR_SUCCESS

        # Button definitions
        button_width = 250
        button_height = 50
        button_y_start = 150 # Move buttons up slightly
        button_spacing = 55 # Reduce spacing slightly
        button_x = (SCREEN_WIDTH - button_width) // 2

        self.buttons = [
            {"rect": pygame.Rect(button_x, button_y_start, button_width, button_height),
             "text": "View Portfolio", "view": "portfolio_view"},
            {"rect": pygame.Rect(button_x, button_y_start + button_spacing, button_width, button_height),
             "text": "Property Market", "view": "market_view"},
            {"rect": pygame.Rect(button_x, button_y_start + 2 * button_spacing, button_width, button_height),
             "text": "Market Status", "view": "market_status_view"},
            {"rect": pygame.Rect(button_x, button_y_start + 3 * button_spacing, button_width, button_height),
             "text": "Upgrades List", "view": "upgrades_list_view"},
            # Loan Buttons (smaller, side-by-side below main buttons)
            {"rect": pygame.Rect(button_x - 70, button_y_start + 4.5 * button_spacing, 120, 40),
             "text": f"Borrow ${LOAN_INCREMENT//1000}k", "action": "borrow"},
            {"rect": pygame.Rect(button_x + 70 + 10, button_y_start + 4.5 * button_spacing, 120, 40),
             "text": f"Repay ${LOAN_INCREMENT//1000}k", "action": "repay"},
            # Save/Load/Quit below loans
            {"rect": pygame.Rect(button_x, button_y_start + 5.5 * button_spacing, button_width, button_height),
             "text": "Save Game", "action": "save"},
            {"rect": pygame.Rect(button_x, button_y_start + 6.5 * button_spacing, button_width, button_height),
             "text": "Load Game", "action": "load"},
            {"rect": pygame.Rect(button_x, button_y_start + 7.5 * button_spacing, button_width, button_height),
             "text": "Quit Game", "action": "quit"}
        ]
        # Adjust font size for smaller loan buttons if needed
        self.font_loan_button = pygame.font.SysFont(None, 32)

        # Next Day Button
        self.next_day_button_rect = pygame.Rect(SCREEN_WIDTH - 170, SCREEN_HEIGHT - 70, 150, 50)

        self.event_display_y = 80 # Move event display up

    def handle_input(self, event):
        """Handles user input for the main menu."""
        if event.type == pygame.MOUSEBUTTONDOWN:
            if event.button == 1: # Left mouse button
                clicked_button = None
                # Check standard buttons
                for button in self.buttons:
                    if button["rect"].collidepoint(event.pos):
                        clicked_button = button
                        break

                if clicked_button:
                    action = clicked_button.get("action")
                    view = clicked_button.get("view")

                    if action == "quit":
                        pygame.event.post(pygame.event.Event(pygame.QUIT))
                    elif action == "save":
                        if save_game(self.game_state): self.show_feedback("Game Saved!")
                        else: self.show_feedback("Save Failed!", error=True)
                    elif action == "load":
                        if load_game(self.game_state): self.show_feedback("Game Loaded!")
                        else: self.show_feedback("Load Failed!", error=True)
                    elif action == "borrow":
                        if self.game_state.player.take_loan(LOAN_INCREMENT):
                            self.show_feedback(f"Borrowed ${LOAN_INCREMENT:,.0f}")
                        else:
                            # Player method prints specific error
                            self.show_feedback("Borrow Failed!", error=True)
                    elif action == "repay":
                        if self.game_state.player.repay_loan(LOAN_INCREMENT):
                            self.show_feedback(f"Repaid ${LOAN_INCREMENT:,.0f}")
                        else:
                            # Player method prints specific error
                            self.show_feedback("Repay Failed!", error=True)
                    elif view:
                        if view == "upgrades_list_view":
                            self.game_state.selected_property_for_renovation = None
                        self.game_state.current_view = view
                        print(f"Changing view to: {self.game_state.current_view}")
                    return # Stop checking

                # Check Next Day button
                if self.next_day_button_rect.collidepoint(event.pos):
                    self.game_state.advance_day()
                    # Feedback moved to advance_day printout
                    # self.show_feedback(f"Advanced to Day {int(self.game_state.game_time)}")
                    return

    def show_feedback(self, message, duration=2.0, error=False):
         """Displays a temporary message on screen."""
         self.feedback_message = message
         self.feedback_timer = duration
         self.feedback_color = COLOR_ERROR if error else COLOR_SUCCESS

    def update(self, dt):
         """Update feedback timer."""
         if self.feedback_timer > 0:
             self.feedback_timer -= dt
             if self.feedback_timer <= 0:
                 self.feedback_message = ""


    def render(self, screen):
        """Renders the main menu UI."""
        # Game Title
        title_surf = self.font_title.render(GAME_TITLE, True, COLOR_TEXT)
        title_rect = title_surf.get_rect(center=(SCREEN_WIDTH // 2, 40))
        screen.blit(title_surf, title_rect)

        # Player Cash
        cash_text = f"Cash: ${self.game_state.player.cash:,.0f}"
        cash_surf = self.font_info.render(cash_text, True, COLOR_TEXT)
        cash_rect = cash_surf.get_rect(topright=(SCREEN_WIDTH - 20, 20))
        screen.blit(cash_surf, cash_rect)

        # Game Time (Day)
        time_text = f"Day: {int(self.game_state.game_time)}"
        time_surf = self.font_info.render(time_text, True, COLOR_TEXT)
        time_rect = time_surf.get_rect(topleft=(20, 20))
        screen.blit(time_surf, time_rect)

        # Loan Amount
        loan_text = f"Loan: ${self.game_state.player.current_loan:,.0f}" # Display loan
        loan_surf = self.font_info.render(loan_text, True, (180, 0, 0) if self.game_state.player.current_loan > 0 else COLOR_TEXT) # Red if loan > 0
        screen.blit(loan_surf, (20, 50)) # Display loan below cash

        # Standard Buttons
        for button in self.buttons:
            is_loan_button = button.get("action") in ["borrow", "repay"]
            font = self.font_loan_button if is_loan_button else self.font_button
            text_surf = font.render(button["text"], True, COLOR_BUTTON_TEXT)
            text_rect = text_surf.get_rect(center=button["rect"].center)
            pygame.draw.rect(screen, COLOR_BUTTON, button["rect"])
            pygame.draw.rect(screen, COLOR_BUTTON_BORDER, button["rect"], 2)
            screen.blit(text_surf, text_rect)

        # Next Day Button
        pygame.draw.rect(screen, (0, 150, 150), self.next_day_button_rect) # Teal color
        pygame.draw.rect(screen, (0, 0, 0), self.next_day_button_rect, 2)
        next_day_text_surf = self.font_day_button.render("Next Day", True, (255, 255, 255))
        next_day_text_rect = next_day_text_surf.get_rect(center=self.next_day_button_rect.center)
        screen.blit(next_day_text_surf, next_day_text_rect)

        # Render Feedback Message
        if self.feedback_message:
            feedback_surf = self.font_feedback.render(self.feedback_message, True, self.feedback_color)
            # Position at bottom center
            feedback_rect = feedback_surf.get_rect(center=(SCREEN_WIDTH // 2, SCREEN_HEIGHT - 25))
            screen.blit(feedback_surf, feedback_rect)

        # Render Active Events (Keep brief summary here)
        event_y = self.event_display_y
        if self.game_state.active_events:
            event_summary = ", ".join([f"{e['name']} ({e['duration_left']}d)" for e in self.game_state.active_events])
            event_text = f"Events: {event_summary}"
            event_surf = self.font_event.render(event_text, True, (150, 50, 0))
            event_rect = event_surf.get_rect(midtop=(SCREEN_WIDTH // 2, event_y))
            # Limit width if too long?
            # max_width = SCREEN_WIDTH - 40
            # if event_rect.width > max_width: ... handle wrapping or clipping ...
            screen.blit(event_surf, event_rect)
        else:
             no_event_surf = self.font_event.render("Market Stable", True, (0, 100, 0))
             no_event_rect = no_event_surf.get_rect(midtop=(SCREEN_WIDTH // 2, event_y))
             screen.blit(no_event_surf, no_event_rect)