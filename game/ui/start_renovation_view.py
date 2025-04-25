import pygame
from ..constants import *
from ..utils.sound_manager import sound_manager # Optional import handled

class StartRenovationView:
    # FIX: Add self and game_state parameters to __init__
    def __init__(self, game_state):
        self.game_state = game_state
        self.selected_property = None # Property to renovate
        self.available_upgrades = [] # List of upgrade dicts from upgrades.json
        self.buttons = []
        self.scroll_offset = 0
        self.font_title = pygame.font.SysFont(None, 48)
        self.font_info = pygame.font.SysFont(None, 30)
        self.font_button = pygame.font.SysFont(None, 32)
        self.font_cost = pygame.font.SysFont(None, 28) # For cost/time display

        # Back button
        self.back_button_rect = pygame.Rect(20, SCREEN_HEIGHT - 60, 100, 40)

        # Load upgrades data (should ideally be done once in GameState, but okay here for now)
        # Ensure upgrades_data is loaded correctly in GameState first
        if self.game_state.upgrades_data:
            self.available_upgrades = self.game_state.upgrades_data
        else:
            print("Error: Upgrades data not loaded in StartRenovationView!")
            self.available_upgrades = [] # Ensure it's an empty list if loading failed

    def set_property(self, property_obj):
        """Sets the property to be renovated and prepares the view."""
        self.selected_property = property_obj
        self.scroll_offset = 0
        self._create_buttons()

    def _create_buttons(self):
        """Creates buttons for available upgrades for the selected property."""
        self.buttons = []
        if not self.selected_property:
            return

        button_y = 120 # Starting Y position for buttons
        button_height = 45
        button_width = SCREEN_WIDTH - 100 # Wide buttons
        button_spacing = 55

        for i, upgrade in enumerate(self.available_upgrades):
            # Check if this upgrade has already been applied
            is_applied = any(up['name'] == upgrade.get('name') for up in self.selected_property.applied_upgrades)
            # Check if renovation is already in progress
            is_renovating = self.selected_property.renovation_progress is not None

            button_rect = pygame.Rect(50, button_y + i * button_spacing, button_width, button_height)

            # Calculate actual cost and time based on player skills and potential events
            cost_multiplier, time_multiplier = self.game_state.player.get_renovation_multipliers()
            actual_cost = int(upgrade.get('base_cost', 0) * cost_multiplier)
            actual_time = int(upgrade.get('base_time_days', 0) * time_multiplier)

            button_data = {
                "rect": button_rect,
                "upgrade_data": upgrade,
                "text": upgrade.get('name', 'Unknown Upgrade'),
                "cost": actual_cost,
                "time": actual_time,
                "action": "start_upgrade",
                "enabled": not is_applied and not is_renovating # Disable if applied or already renovating
            }
            self.buttons.append(button_data)

    def handle_input(self, event):
        if event.type == pygame.MOUSEBUTTONDOWN:
            if event.button == 1: # Left click
                # Back button
                if self.back_button_rect.collidepoint(event.pos):
                    sound_manager.play("click")
                    self.game_state.current_view = "property_detail_view" # Go back to detail view
                    # Optionally clear selected property if needed: self.selected_property = None
                    return

                # Upgrade buttons
                for button in self.buttons:
                    # Adjust button rect for scrolling before checking collision
                    display_rect = button["rect"].move(0, -self.scroll_offset)
                    if display_rect.collidepoint(event.pos) and button["enabled"]:
                        sound_manager.play("click")
                        upgrade_to_start = button["upgrade_data"]
                        cost = button["cost"]
                        time = button["time"]
                        # Attempt to start the renovation via Player method
                        if self.game_state.player.start_property_renovation(self.selected_property, upgrade_to_start, cost, time):
                            # Success - maybe switch view or show feedback
                            self.game_state.current_view = "property_detail_view" # Go back after starting
                        else:
                            # Failed (e.g., insufficient funds) - Player method should handle feedback
                            sound_manager.play("error")
                        return # Action taken

        # Scrolling with mouse wheel
        if event.type == pygame.MOUSEWHEEL:
            self.scroll_offset -= event.y * 20 # Adjust scroll speed as needed
            # Clamp scroll offset
            max_scroll = max(0, len(self.buttons) * 55 + 120 - (SCREEN_HEIGHT - 80)) # Estimate max scroll
            self.scroll_offset = max(0, min(self.scroll_offset, max_scroll))


    def render(self, screen):
        if not self.selected_property:
            # Handle case where no property is selected (shouldn't normally happen if view logic is correct)
            title_surf = self.font_title.render("Select Property First", True, COLOR_ERROR)
            title_rect = title_surf.get_rect(center=(SCREEN_WIDTH // 2, 50))
            screen.blit(title_surf, title_rect)
            # Draw Back button even if no property
            pygame.draw.rect(screen, COLOR_BUTTON, self.back_button_rect)
            pygame.draw.rect(screen, COLOR_BUTTON_BORDER, self.back_button_rect, 2)
            back_text_surf = self.font_button.render("Back", True, COLOR_BUTTON_TEXT)
            back_text_rect = back_text_surf.get_rect(center=self.back_button_rect.center)
            screen.blit(back_text_surf, back_text_rect)
            return

        # Title
        title_text = f"Start Renovation: {self.selected_property.property_type} ({self.selected_property.location})"
        title_surf = self.font_title.render(title_text, True, COLOR_TEXT)
        title_rect = title_surf.get_rect(center=(SCREEN_WIDTH // 2, 50))
        screen.blit(title_surf, title_rect)

        # Back Button
        pygame.draw.rect(screen, COLOR_BUTTON, self.back_button_rect)
        pygame.draw.rect(screen, COLOR_BUTTON_BORDER, self.back_button_rect, 2)
        back_text_surf = self.font_button.render("Back", True, COLOR_BUTTON_TEXT)
        back_text_rect = back_text_surf.get_rect(center=self.back_button_rect.center)
        screen.blit(back_text_surf, back_text_rect)

        # Upgrade Buttons Area (clip drawing to this area if implementing scrolling properly)
        list_area = pygame.Rect(50, 100, SCREEN_WIDTH - 100, SCREEN_HEIGHT - 180)
        # pygame.draw.rect(screen, (230, 230, 230), list_area, 1) # Optional border for list area

        for button in self.buttons:
            display_rect = button["rect"].move(0, -self.scroll_offset)

            # Only render if button is within the visible list area
            if display_rect.colliderect(list_area):
                button_color = COLOR_BUTTON if button["enabled"] else (180, 180, 180) # Grey out disabled
                border_color = COLOR_BUTTON_BORDER if button["enabled"] else (120, 120, 120)
                text_color = COLOR_BUTTON_TEXT if button["enabled"] else (100, 100, 100)

                pygame.draw.rect(screen, button_color, display_rect)
                pygame.draw.rect(screen, border_color, display_rect, 2)

                # Upgrade Name
                text_surf = self.font_button.render(button["text"], True, text_color)
                text_rect = text_surf.get_rect(midleft=(display_rect.left + 15, display_rect.centery))
                screen.blit(text_surf, text_rect)

                # Cost and Time
                cost_time_text = f"Cost: ${button['cost']:,} | Time: {button['time']} days"
                cost_surf = self.font_cost.render(cost_time_text, True, text_color)
                cost_rect = cost_surf.get_rect(midright=(display_rect.right - 15, display_rect.centery))
                screen.blit(cost_surf, cost_rect)

                # Indicate if already applied or renovating
                if not button["enabled"]:
                    status_text = ""
                    if self.selected_property.renovation_progress is not None:
                         status_text = "(Renovating)"
                    elif any(up['name'] == button['upgrade_data'].get('name') for up in self.selected_property.applied_upgrades):
                         status_text = "(Applied)"

                    if status_text:
                        status_surf = self.font_cost.render(status_text, True, (100, 100, 100))
                        # Position near the cost/time text
                        status_rect = status_surf.get_rect(midright=(cost_rect.left - 10, display_rect.centery))
                        screen.blit(status_surf, status_rect)


    def update(self, dt):
        # Recalculate button costs/times/enabled state in case skills/events changed
        # This might be slightly inefficient if called every frame, consider optimizing later
        self._create_buttons()