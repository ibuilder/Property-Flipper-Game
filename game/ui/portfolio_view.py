# filepath: c:\Users\iphoe\OneDrive\Documents\GitHub\Property-Flipper-Game\game\ui\portfolio_view.py
import pygame
from ..constants import * # Import constants

class PortfolioView:
    def __init__(self, game_state):
        self.game_state = game_state
        self.font_title = pygame.font.SysFont(None, 52)
        self.font_info = pygame.font.SysFont(None, 30)
        self.font_button = pygame.font.SysFont(None, 32) # Smaller button font
        self.font_prop = pygame.font.SysFont(None, 28)
        self.font_status = pygame.font.SysFont(None, 24) # For renovation status
        self.font_small_info = pygame.font.SysFont(None, 28) # For tax info

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
        title_surf = self.font_title.render("Your Portfolio", True, COLOR_TEXT)
        title_rect = title_surf.get_rect(center=(SCREEN_WIDTH // 2, 50))
        screen.blit(title_surf, title_rect)

        # Info (Cash, Loan, Estimated Daily Tax)
        cash_text = f"Cash: ${self.game_state.player.cash:,.0f}"
        loan_text = f"Loan: ${self.game_state.player.current_loan:,.0f}"

        # Calculate estimated daily tax
        total_daily_tax = 0
        for prop in self.game_state.player.properties:
            current_value = prop.calculate_value(self.game_state.market, self.game_state)
            daily_tax = int(current_value * PROPERTY_TAX_RATE_DAILY)
            total_daily_tax += daily_tax
        tax_text = f"Est. Daily Tax: ${total_daily_tax:,.0f}"

        cash_surf = self.font_info.render(cash_text, True, COLOR_TEXT)
        loan_surf = self.font_info.render(loan_text, True, (180, 0, 0) if self.game_state.player.current_loan > 0 else COLOR_TEXT)
        tax_surf = self.font_small_info.render(tax_text, True, COLOR_INFO) # Smaller font for tax

        screen.blit(cash_surf, (20, 80))
        screen.blit(loan_surf, (20, 110))
        screen.blit(tax_surf, (SCREEN_WIDTH - tax_surf.get_width() - 20, 85)) # Position tax info top-right

        # Back Button
        pygame.draw.rect(screen, (180, 180, 180), self.back_button_rect)
        pygame.draw.rect(screen, (0, 0, 0), self.back_button_rect, 2)
        back_text_surf = pygame.font.SysFont(None, 36).render("Back", True, (0, 0, 0)) # Re-use font size from market view
        back_text_rect = back_text_surf.get_rect(center=self.back_button_rect.center)
        screen.blit(back_text_surf, back_text_rect)

        # Property Listings
        start_y = 150 # Start listings below info
        line_height = 25
        button_width = 100
        button_height = 35
        current_y = start_y

        if not self.game_state.player.properties:
            no_prop_surf = self.font_info.render("You don't own any properties yet.", True, COLOR_INFO)
            no_prop_rect = no_prop_surf.get_rect(center=(SCREEN_WIDTH // 2, SCREEN_HEIGHT // 2))
            screen.blit(no_prop_surf, no_prop_rect)
        else:
            for prop in self.game_state.player.properties:
                # Property Details
                prop_type_name = prop.type.get('name', 'Unknown Type')
                prop_loc_name = self.game_state.locations.get(prop.location, {}).get('name', prop.location)
                prop_val = prop.calculate_value(self.game_state.market, self.game_state)
                prop_cond = int(prop.condition)

                line1 = f"{prop_type_name} ({prop.id}) in {prop_loc_name}"
                line2 = f"Value: ${prop_val:,.0f} | Condition: {prop_cond}/100"

                # Renovation Status
                status_text = "Ready"
                status_color = (0, 150, 0) # Green
                if prop.renovation_progress:
                    remaining_days = prop.renovation_progress['time_left']
                    upgrade_name = prop.renovation_progress['upgrade'].name
                    status_text = f"Renovating: {upgrade_name} ({remaining_days:.1f}d left)"
                    status_color = (200, 100, 0) # Orange

                status_surf = self.font_status.render(status_text, True, status_color)

                # Render Text
                surf1 = self.font_prop.render(line1, True, COLOR_TEXT)
                surf2 = self.font_prop.render(line2, True, COLOR_INFO)
                screen.blit(surf1, (40, current_y))
                screen.blit(surf2, (40, current_y + line_height))
                screen.blit(status_surf, (40, current_y + 2 * line_height))

                # Buttons (Sell / Start Renovation)
                button_x_start = SCREEN_WIDTH - 2 * button_width - 60
                sell_rect = pygame.Rect(button_x_start, current_y + line_height, button_width, button_height)
                reno_rect = pygame.Rect(button_x_start + button_width + 10, current_y + line_height, button_width, button_height)

                # Sell Button (Always show if not renovating)
                if not prop.renovation_progress:
                    self.sell_buttons[prop.id] = sell_rect
                    pygame.draw.rect(screen, (200, 50, 50), sell_rect) # Reddish button
                    pygame.draw.rect(screen, COLOR_BUTTON_BORDER, sell_rect, 2)
                    sell_text_surf = self.font_button.render("Sell", True, (255, 255, 255))
                    sell_text_rect = sell_text_surf.get_rect(center=sell_rect.center)
                    screen.blit(sell_text_surf, sell_text_rect)
                else:
                    # Optionally draw disabled sell button
                    pygame.draw.rect(screen, (100, 100, 100), sell_rect)
                    pygame.draw.rect(screen, COLOR_BUTTON_BORDER, sell_rect, 2)
                    sell_text_surf = self.font_button.render("Sell", True, (180, 180, 180))
                    sell_text_rect = sell_text_surf.get_rect(center=sell_rect.center)
                    screen.blit(sell_text_surf, sell_text_rect)


                # Renovate Button (Only show if not currently renovating)
                if not prop.renovation_progress:
                    self.renovate_buttons[prop.id] = reno_rect
                    pygame.draw.rect(screen, (50, 50, 200), reno_rect) # Bluish button
                    pygame.draw.rect(screen, COLOR_BUTTON_BORDER, reno_rect, 2)
                    reno_text_surf = self.font_button.render("Renovate", True, (255, 255, 255))
                    reno_text_rect = reno_text_surf.get_rect(center=reno_rect.center)
                    screen.blit(reno_text_surf, reno_text_rect)
                else:
                     # Optionally draw disabled renovate button
                    pygame.draw.rect(screen, (100, 100, 100), reno_rect)
                    pygame.draw.rect(screen, COLOR_BUTTON_BORDER, reno_rect, 2)
                    reno_text_surf = self.font_button.render("Renovate", True, (180, 180, 180))
                    reno_text_rect = reno_text_surf.get_rect(center=reno_rect.center)
                    screen.blit(reno_text_surf, reno_text_rect)

                # Separator
                current_y += 3 * line_height + 20
                pygame.draw.line(screen, (200, 200, 200), (20, current_y - 10), (SCREEN_WIDTH - 20, current_y - 10), 1)