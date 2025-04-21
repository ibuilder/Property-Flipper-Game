# filepath: c:\Users\iphoe\OneDrive\Documents\GitHub\Property-Flipper-Game\game\ui\upgrades_view.py
import pygame
from ..constants import SCREEN_WIDTH, SCREEN_HEIGHT
from ..entities.upgrade import Upgrade # Import the Upgrade class

class UpgradesView:
    def __init__(self, game_state):
        self.game_state = game_state
        self.font_title = pygame.font.SysFont(None, 52)
        self.font_info = pygame.font.SysFont(None, 30)
        self.font_prop_hdr = pygame.font.SysFont(None, 36)
        self.font_prop_info = pygame.font.SysFont(None, 28)
        self.font_upgrade = pygame.font.SysFont(None, 28)
        self.font_button = pygame.font.SysFont(None, 32)

        # Button dimensions
        self.button_width = 150 # Wider button for "Start Renovation"
        self.button_height = 30
        self.back_button_rect = pygame.Rect(20, SCREEN_HEIGHT - 60, 100, 40)

        # Store button rects mapped to upgrade IDs
        self.start_buttons = {}

    def handle_input(self, event):
        """Handles user input for the upgrades view."""
        if event.type == pygame.MOUSEBUTTONDOWN:
            if event.button == 1: # Left click
                # Check Back button
                if self.back_button_rect.collidepoint(event.pos):
                    self.game_state.current_view = "portfolio_view"
                    # Clear selected property when going back
                    self.game_state.selected_property_for_renovation = None
                    print("Returning to Portfolio View")
                    return

                # Check Start Renovation buttons
                selected_prop = self.game_state.selected_property_for_renovation
                if not selected_prop: return # Should not happen, but safety check

                for upgrade_id, rect in self.start_buttons.items():
                    if rect.collidepoint(event.pos):
                        upgrade_data = self.game_state.upgrade_types.get(upgrade_id)
                        if upgrade_data:
                            # Create an Upgrade object instance
                            upgrade_obj = Upgrade(
                                upgrade_id=upgrade_id,
                                name=upgrade_data.get("name", "Unknown Upgrade"),
                                cost=upgrade_data.get("cost", 0),
                                value_increase=upgrade_data.get("value_increase", 0),
                                condition_increase=upgrade_data.get("condition_increase", 0),
                                time_required=upgrade_data.get("time_required", 1)
                            )

                            print(f"Attempting to start renovation '{upgrade_obj.name}' for property {selected_prop.id}")
                            success = self.game_state.player.start_property_renovation(selected_prop, upgrade_obj)

                            if success:
                                # Return to portfolio view after starting
                                self.game_state.current_view = "portfolio_view"
                                # Clear selected property
                                self.game_state.selected_property_for_renovation = None
                                print(f"Renovation started. Returning to Portfolio View.")
                            # else: start_property_renovation prints failure message
                        break # Stop checking buttons

    def render(self, screen):
        """Renders the upgrades view UI."""
        self.start_buttons.clear() # Clear buttons from previous frame

        # Title
        title_surf = self.font_title.render("Select Upgrade", True, (0, 0, 0))
        title_rect = title_surf.get_rect(center=(SCREEN_WIDTH // 2, 40))
        screen.blit(title_surf, title_rect)

        # Back Button
        pygame.draw.rect(screen, (180, 180, 180), self.back_button_rect)
        pygame.draw.rect(screen, (0, 0, 0), self.back_button_rect, 2)
        back_text_surf = pygame.font.SysFont(None, 36).render("Back", True, (0, 0, 0))
        back_text_rect = back_text_surf.get_rect(center=self.back_button_rect.center)
        screen.blit(back_text_surf, back_text_rect)

        # Selected Property Info
        selected_prop = self.game_state.selected_property_for_renovation
        prop_info_y = 80
        if selected_prop:
            prop_name = selected_prop.type.get("name", "Unknown Type")
            prop_id = selected_prop.id
            header_text = f"Renovating: {prop_name} ({prop_id})"
            header_surf = self.font_prop_hdr.render(header_text, True, (0, 0, 100))
            header_rect = header_surf.get_rect(center=(SCREEN_WIDTH // 2, prop_info_y))
            screen.blit(header_surf, header_rect)

            # Display current condition, value etc. if needed
            cond_text = f"Condition: {int(selected_prop.condition)}/100"
            val = selected_prop.calculate_value(self.game_state.market)
            val_text = f"Value: ${val:,.0f}"
            cash_text = f"Cash: ${self.game_state.player.cash:,.0f}"

            cond_surf = self.font_prop_info.render(cond_text, True, (50, 50, 50))
            val_surf = self.font_prop_info.render(val_text, True, (0, 80, 0))
            cash_surf = self.font_prop_info.render(cash_text, True, (0, 100, 0))

            screen.blit(cond_surf, (40, prop_info_y + 30))
            screen.blit(val_surf, (40, prop_info_y + 55))
            screen.blit(cash_surf, (SCREEN_WIDTH - cash_surf.get_width() - 40, prop_info_y + 30))

        else:
            # Should not happen if navigation is correct
            no_prop_surf = self.font_info.render("No property selected for renovation.", True, (255, 0, 0))
            no_prop_rect = no_prop_surf.get_rect(center=(SCREEN_WIDTH // 2, prop_info_y + 40))
            screen.blit(no_prop_surf, no_prop_rect)
            return # Don't render upgrades if no property selected

        # Available Upgrades List
        start_y = prop_info_y + 90
        line_height = 22
        upgrade_area_height = SCREEN_HEIGHT - start_y - 80

        current_y = start_y
        for upgrade_id, data in self.game_state.upgrade_types.items():
            if current_y + 80 > start_y + upgrade_area_height:
                 break # Stop rendering if out of space

            # Check if upgrade already applied to this property
            already_applied = any(up.id == upgrade_id for up in selected_prop.upgrades)
            if already_applied:
                continue # Skip rendering this upgrade if already done

            # Check if player can afford
            can_afford = self.game_state.player.cash >= data.get("cost", 0)

            # Upgrade Details
            name = data.get("name", "Unknown Upgrade")
            cost = data.get("cost", 0)
            val_inc = data.get("value_increase", 0)
            cond_inc = data.get("condition_increase", 0)
            time_req = data.get("time_required", 1)

            line1 = f"{name} (Cost: ${cost:,.0f})"
            line2 = f"Adds Value: ${val_inc:,.0f} | Improves Condition: +{cond_inc} | Time: {time_req} days"

            color1 = (0, 0, 0) if can_afford else (150, 0, 0) # Dim if cannot afford
            color2 = (50, 50, 50) if can_afford else (150, 100, 100)

            surf1 = self.font_upgrade.render(line1, True, color1)
            surf2 = self.font_upgrade.render(line2, True, color2)

            screen.blit(surf1, (40, current_y))
            screen.blit(surf2, (40, current_y + line_height))

            # Start Renovation Button
            button_x = SCREEN_WIDTH - self.button_width - 40
            button_y = current_y + (line_height / 2) # Align vertically
            start_rect = pygame.Rect(button_x, button_y, self.button_width, self.button_height)

            # Only store button if affordable (prevents clicking unaffordable ones)
            if can_afford:
                self.start_buttons[upgrade_id] = start_rect

                # Draw Button
                pygame.draw.rect(screen, (0, 150, 0), start_rect) # Greenish
                pygame.draw.rect(screen, (0, 0, 0), start_rect, 2) # Border
                start_text_surf = self.font_button.render("Start Renovation", True, (255, 255, 255))
                start_text_rect = start_text_surf.get_rect(center=start_rect.center)
                screen.blit(start_text_surf, start_text_rect)
            else:
                # Draw disabled-looking button
                pygame.draw.rect(screen, (100, 100, 100), start_rect) # Grey
                pygame.draw.rect(screen, (50, 50, 50), start_rect, 2) # Darker Border
                start_text_surf = self.font_button.render("Too Expensive", True, (200, 200, 200))
                start_text_rect = start_text_surf.get_rect(center=start_rect.center)
                screen.blit(start_text_surf, start_text_rect)


            # Draw separator line
            current_y += 2 * line_height + 20 # Move down for next upgrade + spacing
            pygame.draw.line(screen, (200, 200, 200), (20, current_y - 10), (SCREEN_WIDTH - 20, current_y - 10), 1)

        if not self.game_state.upgrade_types: # Or if all upgrades are applied/unaffordable
             no_upg_surf = self.font_info.render("No available upgrades.", True, (100, 100, 100))
             no_upg_rect = no_upg_surf.get_rect(center=(SCREEN_WIDTH // 2, start_y + 50))
             screen.blit(no_upg_surf, no_upg_rect)
