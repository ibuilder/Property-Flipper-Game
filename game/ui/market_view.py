# filepath: c:\Users\iphoe\OneDrive\Documents\GitHub\Property-Flipper-Game\game\ui\market_view.py
import pygame
from ..constants import SCREEN_WIDTH, SCREEN_HEIGHT

class MarketView:
    def __init__(self, game_state):
        self.game_state = game_state
        self.font_title = pygame.font.SysFont(None, 52)
        self.font_info = pygame.font.SysFont(None, 30)
        self.font_button = pygame.font.SysFont(None, 36)
        self.font_prop = pygame.font.SysFont(None, 28)

        # Button dimensions
        self.button_width = 80
        self.button_height = 30
        self.back_button_rect = pygame.Rect(20, SCREEN_HEIGHT - 60, 100, 40)

        # Store button rects mapped to property IDs for input handling
        self.buy_buttons = {}

    def handle_input(self, event):
        """Handles user input for the market view."""
        if event.type == pygame.MOUSEBUTTONDOWN:
            if event.button == 1: # Left click
                # Check Back button
                if self.back_button_rect.collidepoint(event.pos):
                    self.game_state.current_view = "main_menu"
                    print("Returning to Main Menu")
                    return # Don't check other buttons

                # Check Buy buttons
                for prop_id, rect in self.buy_buttons.items():
                    if rect.collidepoint(event.pos):
                        prop_to_buy = next((p for p in self.game_state.properties_for_sale if p.id == prop_id), None)
                        if prop_to_buy:
                            print(f"Attempting to buy property: {prop_id}")
                            success = self.game_state.player.buy_property(prop_to_buy, self.game_state.market)
                            if success:
                                # Remove property from market list if bought
                                self.game_state.properties_for_sale.remove(prop_to_buy)
                                # Important: Clear buttons dict as rects will change next render
                                self.buy_buttons.clear()
                                print(f"Successfully bought {prop_id}. Remaining cash: ${self.game_state.player.cash}")
                            # else: buy_property already prints failure message
                        break # Stop checking buy buttons

    def render(self, screen):
        """Renders the market view UI."""
        # Clear buy buttons from previous frame before recalculating positions
        self.buy_buttons.clear()

        # Title
        title_surf = self.font_title.render("Property Market", True, (0, 0, 0))
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
        back_text_surf = self.font_button.render("Back", True, (0, 0, 0))
        back_text_rect = back_text_surf.get_rect(center=self.back_button_rect.center)
        screen.blit(back_text_surf, back_text_rect)

        # Property Listings
        start_y = 120
        line_height = 25
        prop_area_height = SCREEN_HEIGHT - start_y - 80 # Area for listings above back button
        # Basic scrolling could be added here if needed

        current_y = start_y
        for prop in self.game_state.properties_for_sale:
            if current_y + 80 > start_y + prop_area_height: # Check if space for next item
                 break # Stop rendering if out of space

            # Property Details
            prop_name = prop.type.get("name", "Unknown Type")
            prop_loc = self.game_state.locations.get(prop.location, {}).get("name", prop.location)
            prop_cond = prop.condition
            prop_val = prop.calculate_value(self.game_state.market, self.game_state) # <<< PASS game_state

            line1 = f"{prop_name} ({prop.id})"
            line2 = f"Location: {prop_loc} | Condition: {prop_cond}/100"
            line3 = f"Value: ${prop_val:,.0f}"

            surf1 = self.font_prop.render(line1, True, (0, 0, 0))
            surf2 = self.font_prop.render(line2, True, (50, 50, 50))
            surf3 = self.font_prop.render(line3, True, (0, 80, 0))

            screen.blit(surf1, (40, current_y))
            screen.blit(surf2, (40, current_y + line_height))
            screen.blit(surf3, (40, current_y + 2 * line_height))

            # Buy Button for this property
            buy_button_x = SCREEN_WIDTH - self.button_width - 40
            buy_button_y = current_y + line_height # Align vertically with middle line
            buy_rect = pygame.Rect(buy_button_x, buy_button_y, self.button_width, self.button_height)
            self.buy_buttons[prop.id] = buy_rect # Store rect for click detection

            # Draw Buy Button
            pygame.draw.rect(screen, (0, 180, 0), buy_rect) # Green background
            pygame.draw.rect(screen, (0, 0, 0), buy_rect, 2) # Border
            buy_text_surf = self.font_button.render("Buy", True, (255, 255, 255)) # White text
            buy_text_rect = buy_text_surf.get_rect(center=buy_rect.center)
            screen.blit(buy_text_surf, buy_text_rect)

            # Draw separator line
            current_y += 3 * line_height + 15 # Move down for next property + spacing
            pygame.draw.line(screen, (200, 200, 200), (20, current_y - 7), (SCREEN_WIDTH - 20, current_y - 7), 1)

        if not self.game_state.properties_for_sale:
             no_prop_surf = self.font_info.render("No properties currently on the market.", True, (100, 100, 100))
             no_prop_rect = no_prop_surf.get_rect(center=(SCREEN_WIDTH // 2, SCREEN_HEIGHT // 2))
             screen.blit(no_prop_surf, no_prop_rect)