# filepath: c:\Users\iphoe\OneDrive\Documents\GitHub\Property-Flipper-Game\game\ui\portfolio_view.py
import pygame
from ..constants import SCREEN_WIDTH, SCREEN_HEIGHT

class PortfolioView:
    def __init__(self, game_state):
        self.game_state = game_state
        self.font_title = pygame.font.SysFont(None, 52)
        self.font_info = pygame.font.SysFont(None, 30)
        self.font_button = pygame.font.SysFont(None, 32) # Smaller button font
        self.font_prop = pygame.font.SysFont(None, 28)
        self.font_status = pygame.font.SysFont(None, 24) # For renovation status

        # Button dimensions
        self.button_width = 80
        self.button_height = 28 # Smaller buttons
        self.back_button_rect = pygame.Rect(20, SCREEN_HEIGHT - 60, 100, 40)

        # Store button rects mapped to property IDs for input handling
        self.sell_buttons = {}
        self.renovate_buttons = {}

    def handle_input(self, event):
        """Handles user input for the portfolio view."""
        if event.type == pygame.MOUSEBUTTONDOWN:
            if event.button == 1: # Left click
                # Check Back button
                if self.back_button_rect.collidepoint(event.pos):
                    self.game_state.current_view = "main_menu"
                    print("Returning to Main Menu")
                    return # Don't check other buttons

                # Check Sell buttons
                for prop_id, rect in self.sell_buttons.items():
                    if rect.collidepoint(event.pos):
                        prop_to_sell = self.game_state.get_property_by_id(prop_id)
                        if prop_to_sell:
                            print(f"Attempting to sell property: {prop_id}")
                            success = self.game_state.player.sell_property(prop_to_sell, self.game_state.market)
                            if success:
                                # Buttons will be cleared on next render anyway
                                print(f"Successfully sold {prop_id}. Current cash: ${self.game_state.player.cash}")
                            # else: sell_property prints failure message
                        break # Stop checking sell buttons

                # Check Renovate buttons
                for prop_id, rect in self.renovate_buttons.items():
                    if rect.collidepoint(event.pos):
                        prop_to_renovate = self.game_state.get_property_by_id(prop_id)
                        if prop_to_renovate:
                            if prop_to_renovate.renovation_progress:
                                 print(f"Property {prop_id} is already under renovation.")
                            else:
                                 self.game_state.selected_property_for_renovation = prop_to_renovate
                                 self.game_state.current_view = "start_renovation_view" # <<< USE RENAMED VIEW
                                 print(f"Selected property {prop_id} for renovation. Changing view.")
                        break # Stop checking renovate buttons


    def render(self, screen):
        """Renders the portfolio view UI."""
        # Clear buttons from previous frame
        self.sell_buttons.clear()
        self.renovate_buttons.clear()

        # Title
        title_surf = self.font_title.render("My Portfolio", True, (0, 0, 0))
        title_rect = title_surf.get_rect(center=(SCREEN_WIDTH // 2, 50))
        screen.blit(title_surf, title_rect)

        # Player Cash
        cash_text = f"Cash: ${self.game_state.player.cash:,.0f}"
        cash_surf = self.font_info.render(cash_text, True, (0, 100, 0))
        cash_rect = cash_surf.get_rect(topright=(SCREEN_WIDTH - 20, 20))
        screen.blit(cash_surf, cash_rect)

        # Back Button
        pygame.draw.rect(screen, (180, 180, 180), self.back_button_rect)
        pygame.draw.rect(screen, (0, 0, 0), self.back_button_rect, 2)
        back_text_surf = pygame.font.SysFont(None, 36).render("Back", True, (0, 0, 0)) # Re-use font size from market view
        back_text_rect = back_text_surf.get_rect(center=self.back_button_rect.center)
        screen.blit(back_text_surf, back_text_rect)

        # Property Listings
        start_y = 120
        line_height = 25
        prop_area_height = SCREEN_HEIGHT - start_y - 80
        button_spacing = 10 # Horizontal space between buttons

        current_y = start_y
        for prop in self.game_state.player.properties:
            if current_y + 100 > start_y + prop_area_height: # Estimate height needed
                 break # Stop rendering if out of space

            # Property Details
            prop_name = prop.type.get("name", "Unknown Type")
            prop_loc = self.game_state.locations.get(prop.location, {}).get("name", prop.location)
            prop_cond = prop.condition
            prop_val = prop.calculate_value(self.game_state.market)
            upgrades_count = len(prop.upgrades)

            line1 = f"{prop_name} ({prop.id})"
            line2 = f"Location: {prop_loc} | Condition: {int(prop_cond)}/100 | Upgrades: {upgrades_count}"
            line3 = f"Current Value: ${prop_val:,.0f}"

            surf1 = self.font_prop.render(line1, True, (0, 0, 0))
            surf2 = self.font_prop.render(line2, True, (50, 50, 50))
            surf3 = self.font_prop.render(line3, True, (0, 80, 0))

            screen.blit(surf1, (40, current_y))
            screen.blit(surf2, (40, current_y + line_height))
            screen.blit(surf3, (40, current_y + 2 * line_height))

            # Renovation Status
            status_y = current_y + 3 * line_height + 2
            if prop.renovation_progress:
                upgrade_name = prop.renovation_progress['upgrade'].name
                time_left = prop.renovation_progress['time_left']
                status_text = f"Renovating: {upgrade_name} ({time_left:.1f} days left)"
                status_color = (200, 100, 0) # Orange-ish
                status_surf = self.font_status.render(status_text, True, status_color)
                screen.blit(status_surf, (40, status_y))


            # Buttons (Sell, Renovate)
            button_y = current_y + line_height # Align vertically with middle line
            sell_button_x = SCREEN_WIDTH - self.button_width * 2 - button_spacing - 40
            renovate_button_x = SCREEN_WIDTH - self.button_width - 40

            # Sell Button
            sell_rect = pygame.Rect(sell_button_x, button_y, self.button_width, self.button_height)
            self.sell_buttons[prop.id] = sell_rect
            sell_color = (200, 0, 0) if not prop.renovation_progress else (100, 100, 100) # Grey out if renovating
            pygame.draw.rect(screen, sell_color, sell_rect)
            pygame.draw.rect(screen, (0, 0, 0), sell_rect, 2)
            sell_text_surf = self.font_button.render("Sell", True, (255, 255, 255))
            sell_text_rect = sell_text_surf.get_rect(center=sell_rect.center)
            screen.blit(sell_text_surf, sell_text_rect)

            # Renovate Button
            renovate_rect = pygame.Rect(renovate_button_x, button_y, self.button_width, self.button_height)
            self.renovate_buttons[prop.id] = renovate_rect
            renovate_color = (0, 0, 200) if not prop.renovation_progress else (100, 100, 100) # Grey out if renovating
            pygame.draw.rect(screen, renovate_color, renovate_rect)
            pygame.draw.rect(screen, (0, 0, 0), renovate_rect, 2)
            renovate_text_surf = self.font_button.render("Renovate", True, (255, 255, 255))
            renovate_text_rect = renovate_text_surf.get_rect(center=renovate_rect.center)
            screen.blit(renovate_text_surf, renovate_text_rect)


            # Draw separator line
            current_y += 4 * line_height + 15 # Move down for next property + spacing (added space for status)
            pygame.draw.line(screen, (200, 200, 200), (20, current_y - 7), (SCREEN_WIDTH - 20, current_y - 7), 1)

        if not self.game_state.player.properties:
             no_prop_surf = self.font_info.render("You do not own any properties.", True, (100, 100, 100))
             no_prop_rect = no_prop_surf.get_rect(center=(SCREEN_WIDTH // 2, SCREEN_HEIGHT // 2))
             screen.blit(no_prop_surf, no_prop_rect)