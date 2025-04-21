# filepath: c:\Users\iphoe\OneDrive\Documents\GitHub\Property-Flipper-Game\game\ui\upgrades_list_view.py
import pygame
from ..constants import SCREEN_WIDTH, SCREEN_HEIGHT

# Simple view to just list available upgrades from the JSON data
class UpgradesListView:
    def __init__(self, game_state):
        self.game_state = game_state
        self.font_title = pygame.font.SysFont(None, 52)
        self.font_info = pygame.font.SysFont(None, 30)
        self.font_upgrade = pygame.font.SysFont(None, 28)
        self.font_button = pygame.font.SysFont(None, 36)
        self.back_button_rect = pygame.Rect(20, SCREEN_HEIGHT - 60, 100, 40)

    def handle_input(self, event):
        if event.type == pygame.MOUSEBUTTONDOWN:
            if event.button == 1: # Left click
                if self.back_button_rect.collidepoint(event.pos):
                    self.game_state.current_view = "main_menu"
                    print("Returning to Main Menu")
                    return

    def render(self, screen):
        # Title
        title_surf = self.font_title.render("Available Upgrades", True, (0, 0, 0))
        title_rect = title_surf.get_rect(center=(SCREEN_WIDTH // 2, 50))
        screen.blit(title_surf, title_rect)

        # Back Button
        pygame.draw.rect(screen, (180, 180, 180), self.back_button_rect)
        pygame.draw.rect(screen, (0, 0, 0), self.back_button_rect, 2)
        back_text_surf = self.font_button.render("Back", True, (0, 0, 0))
        back_text_rect = back_text_surf.get_rect(center=self.back_button_rect.center)
        screen.blit(back_text_surf, back_text_rect)

        # Upgrades List
        start_y = 120
        line_height = 22
        upgrade_area_height = SCREEN_HEIGHT - start_y - 80
        current_y = start_y

        for upgrade_id, data in self.game_state.upgrade_types.items():
            if current_y + 60 > start_y + upgrade_area_height:
                 break

            name = data.get("name", "Unknown Upgrade")
            cost = data.get("cost", 0)
            val_inc = data.get("value_increase", 0)
            cond_inc = data.get("condition_increase", 0)
            time_req = data.get("time_required", 1)

            line1 = f"{name} (Cost: ${cost:,.0f})"
            line2 = f"Adds Value: ${val_inc:,.0f} | Improves Condition: +{cond_inc} | Time: {time_req} days"

            surf1 = self.font_upgrade.render(line1, True, (0,0,0))
            surf2 = self.font_upgrade.render(line2, True, (50,50,50))

            screen.blit(surf1, (40, current_y))
            screen.blit(surf2, (40, current_y + line_height))

            current_y += 2 * line_height + 15
            pygame.draw.line(screen, (200, 200, 200), (20, current_y - 7), (SCREEN_WIDTH - 20, current_y - 7), 1)

        if not self.game_state.upgrade_types:
             no_upg_surf = self.font_info.render("No upgrade data loaded.", True, (100, 100, 100))
             no_upg_rect = no_upg_surf.get_rect(center=(SCREEN_WIDTH // 2, start_y + 50))
             screen.blit(no_upg_surf, no_upg_rect)