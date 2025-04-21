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
        self.font_status = pygame.font.SysFont(None, 28) # For contractor status
        self.feedback_message = ""
        self.feedback_timer = 0
        self.feedback_color = COLOR_SUCCESS

        # Button definitions (Adjust layout slightly)
        button_width = 250
        button_height = 50
        button_y_start = 160 # Move down slightly
        button_spacing = 55
        button_x = (SCREEN_WIDTH - button_width) // 2

        # Smaller button dimensions
        small_button_width = 120
        small_button_height = 40
        small_button_spacing = 10 # Space between small buttons

        self.buttons = [
            {"rect": pygame.Rect(button_x, button_y_start, button_width, button_height),
             "text": "View Portfolio", "view": "portfolio_view"},
            {"rect": pygame.Rect(button_x, button_y_start + button_spacing, button_width, button_height),
             "text": "Property Market", "view": "market_view"},
            {"rect": pygame.Rect(button_x, button_y_start + 2 * button_spacing, button_width, button_height),
             "text": "Market Status", "view": "market_status_view"},
            {"rect": pygame.Rect(button_x, button_y_start + 3 * button_spacing, button_width, button_height),
             "text": "Upgrades List", "view": "upgrades_list_view"},

            # Loan Buttons (Row 1 of small buttons)
            {"rect": pygame.Rect(button_x - small_button_width/2 - small_button_spacing/2, button_y_start + 4.2 * button_spacing, small_button_width, small_button_height),
             "text": f"Borrow ${LOAN_INCREMENT//1000}k", "action": "borrow", "font": self.font_loan_button},
            {"rect": pygame.Rect(button_x + small_button_width/2 + small_button_spacing/2, button_y_start + 4.2 * button_spacing, small_button_width, small_button_height),
             "text": f"Repay ${LOAN_INCREMENT//1000}k", "action": "repay", "font": self.font_loan_button},

            # Contractor Buttons (Row 2 of small buttons)
            {"rect": pygame.Rect(button_x - small_button_width/2 - small_button_spacing/2, button_y_start + 5.0 * button_spacing, small_button_width, small_button_height),
             "text": "Hire Crew", "action": "hire_contractor", "font": self.font_loan_button}, # Use same smaller font
            {"rect": pygame.Rect(button_x + small_button_width/2 + small_button_spacing/2, button_y_start + 5.0 * button_spacing, small_button_width, small_button_height),
             "text": "Fire Crew", "action": "fire_contractor", "font": self.font_loan_button},

            # Save/Load/Quit below small buttons
            {"rect": pygame.Rect(button_x, button_y_start + 6.0 * button_spacing, button_width, button_height),
             "text": "Save Game", "action": "save"},
            {"rect": pygame.Rect(button_x, button_y_start + 7.0 * button_spacing, button_width, button_height),
             "text": "Load Game", "action": "load"},
            {"rect": pygame.Rect(button_x, button_y_start + 8.0 * button_spacing, button_width, button_height),
             "text": "Quit Game", "action": "quit"}
        ]
        self.font_loan_button = pygame.font.SysFont(None, 32) # Font for small buttons

        # Next Day Button
        self.next_day_button_rect = pygame.Rect(SCREEN_WIDTH - 170, SCREEN_HEIGHT - 70, 150, 50)

        self.event_display_y = 80 # Position for event text
        self.info_y = self.event_display_y + 30 # Position for cash/time/loan/status

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
                    elif action == "hire_contractor": # <<< HANDLE HIRE
                        if self.game_state.player.hire_contractor(): self.show_feedback("Contractor Hired!")
                        else: self.show_feedback("Already Hired", error=True)
                    elif action == "fire_contractor": # <<< HANDLE FIRE
                        if self.game_state.player.fire_contractor(): self.show_feedback("Contractor Fired!")
                        else: self.show_feedback("Not Hired", error=True)
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

        # Info (Cash, Time, Loan, Contractor Status)
        cash_text = f"Cash: ${self.game_state.player.cash:,.0f}"
        time_text = f"Day: {int(self.game_state.game_time)}"
        loan_text = f"Loan: ${self.game_state.player.current_loan:,.0f}"
        # Contractor Status
        if self.game_state.player.has_contractor:
            status_text = f"Crew Hired (Wage: ${CONTRACTOR_DAILY_WAGE}/day)"
            status_color = (0, 120, 180) # Blueish
        else:
            status_text = "No Crew Hired"
            status_color = COLOR_INFO

        cash_surf = self.font_info.render(cash_text, True, COLOR_TEXT)
        time_surf = self.font_info.render(time_text, True, COLOR_TEXT)
        loan_surf = self.font_info.render(loan_text, True, (180, 0, 0) if self.game_state.player.current_loan > 0 else COLOR_TEXT)
        status_surf = self.font_status.render(status_text, True, status_color) # Use status font

        screen.blit(cash_surf, (20, self.info_y))
        screen.blit(time_surf, (SCREEN_WIDTH - time_surf.get_width() - 20, self.info_y))
        screen.blit(loan_surf, (20, self.info_y + 25))
        screen.blit(status_surf, (20, self.info_y + 50)) # Display status below loan

        # Standard Buttons
        for button in self.buttons:
            is_loan_button = button.get("action") in ["borrow", "repay"]
            font = self.font_loan_button if is_loan_button else self.font_button
            text_surf = font.render(button["text"], True, COLOR_BUTTON_TEXT)
            text_rect = text_surf.get_rect(center=button["rect"].center)
            pygame.draw.rect(screen, COLOR_BUTTON, button["rect"])
            pygame.draw.rect(screen, COLOR_BUTTON_BORDER, button["rect"], 2)
            screen.blit(text_surf, text_rect)

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

        # Render Buttons
        for button in self.buttons:
            # Use specified font or default button font
            font = button.get("font", self.font_button)
            text_surf = font.render(button["text"], True, COLOR_BUTTON_TEXT)
            text_rect = text_surf.get_rect(center=button["rect"].center)

            # Grey out Hire/Fire buttons if not applicable
            action = button.get("action")
            button_color = COLOR_BUTTON
            if action == "hire_contractor" and self.game_state.player.has_contractor:
                button_color = (100, 100, 100) # Grey out Hire if already hired
            elif action == "fire_contractor" and not self.game_state.player.has_contractor:
                button_color = (100, 100, 100) # Grey out Fire if not hired

            pygame.draw.rect(screen, button_color, button["rect"])
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