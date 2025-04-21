# filepath: c:\Users\iphoe\OneDrive\Documents\GitHub\Property-Flipper-Game\game\ui\market_status_view.py
import pygame
from ..constants import SCREEN_WIDTH, SCREEN_HEIGHT

class MarketStatusView:
    def __init__(self, game_state):
        self.game_state = game_state
        self.font_title = pygame.font.SysFont(None, 52)
        self.font_header = pygame.font.SysFont(None, 38)
        self.font_info = pygame.font.SysFont(None, 30)
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
        title_surf = self.font_title.render("Market Status", True, (0, 0, 0))
        title_rect = title_surf.get_rect(center=(SCREEN_WIDTH // 2, 50))
        screen.blit(title_surf, title_rect)

        # Back Button
        pygame.draw.rect(screen, (180, 180, 180), self.back_button_rect)
        pygame.draw.rect(screen, (0, 0, 0), self.back_button_rect, 2)
        back_text_surf = self.font_button.render("Back", True, (0, 0, 0))
        back_text_rect = back_text_surf.get_rect(center=self.back_button_rect.center)
        screen.blit(back_text_surf, back_text_rect)

        # Active Events Section
        event_y = 120
        event_header_surf = self.font_header.render("Active Market Events", True, (0, 0, 100))
        event_header_rect = event_header_surf.get_rect(topleft=(40, event_y))
        screen.blit(event_header_surf, event_header_rect)
        current_y = event_y + 40

        if self.game_state.active_events:
            for event in self.game_state.active_events:
                name = event.get('name', 'Unknown Event')
                duration = event.get('duration_left', 0)
                event_text = f"- {name} ({duration} days left)"
                event_surf = self.font_info.render(event_text, True, (150, 50, 0))
                screen.blit(event_surf, (60, current_y))
                current_y += 30
                # Optionally list effects
                # for effect in event.get('effects', []):
                #    effect_text = f"  > {effect.get('type')} ({effect.get('location', 'all')}: {effect.get('amount')})"
                #    effect_surf = pygame.font.SysFont(None, 26).render(effect_text, True, (80, 80, 80))
                #    screen.blit(effect_surf, (70, current_y))
                #    current_y += 25
        else:
            no_event_surf = self.font_info.render("Market is stable.", True, (0, 100, 0))
            screen.blit(no_event_surf, (60, current_y))
            current_y += 30

        # Location Multipliers Section
        loc_y = current_y + 30
        loc_header_surf = self.font_header.render("Location Value Multipliers", True, (0, 0, 100))
        loc_header_rect = loc_header_surf.get_rect(topleft=(40, loc_y))
        screen.blit(loc_header_surf, loc_header_rect)
        current_y = loc_y + 40

        if self.game_state.locations and hasattr(self.game_state.market, '_base_location_multipliers'):
            col1_x = 60
            col2_x = 300
            col3_x = 450
            col4_x = 600

            # Headers
            hdr_font = pygame.font.SysFont(None, 28, bold=True)
            screen.blit(hdr_font.render("Location", True, (0,0,0)), (col1_x, current_y))
            screen.blit(hdr_font.render("Base Mult.", True, (0,0,0)), (col2_x, current_y))
            screen.blit(hdr_font.render("Event Mod.", True, (0,0,0)), (col3_x, current_y))
            screen.blit(hdr_font.render("Current Mult.", True, (0,0,0)), (col4_x, current_y))
            current_y += 25
            pygame.draw.line(screen, (150,150,150), (col1_x, current_y), (col4_x + 120, current_y), 1)
            current_y += 10


            for loc_id, loc_data in self.game_state.locations.items():
                loc_name = loc_data.get("name", loc_id)
                base_mult = self.game_state.market._base_location_multipliers.get(loc_id, 1.0)
                event_mod = self.game_state.get_active_event_modifier(loc_id, "value_multiplier")
                current_mult = base_mult * event_mod

                # Determine color based on change
                if abs(current_mult - base_mult) < 0.01:
                    color = (50, 50, 50) # No change
                elif current_mult > base_mult:
                    color = (0, 120, 0) # Increased (Green)
                else:
                    color = (180, 0, 0) # Decreased (Red)

                name_surf = self.font_info.render(loc_name, True, (0,0,0))
                base_surf = self.font_info.render(f"{base_mult:.2f}x", True, (80,80,80))
                mod_surf = self.font_info.render(f"{event_mod:.2f}x", True, color)
                curr_surf = self.font_info.render(f"{current_mult:.2f}x", True, color)

                screen.blit(name_surf, (col1_x, current_y))
                screen.blit(base_surf, (col2_x, current_y))
                screen.blit(mod_surf, (col3_x, current_y))
                screen.blit(curr_surf, (col4_x, current_y))
                current_y += 30

        else:
            no_loc_surf = self.font_info.render("Location data not available.", True, (100, 100, 100))
            screen.blit(no_loc_surf, (60, current_y))