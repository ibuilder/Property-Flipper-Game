# filepath: c:\Users\iphoe\OneDrive\Documents\GitHub\Property-Flipper-Game\game\ui\win_screen.py
import pygame
from ..constants import SCREEN_WIDTH, SCREEN_HEIGHT, WIN_CONDITION_CASH

class WinScreen:
    def __init__(self, game_state):
        self.game_state = game_state
        self.font_title = pygame.font.SysFont(None, 80)
        self.font_info = pygame.font.SysFont(None, 40)
        self.font_button = pygame.font.SysFont(None, 48)

        # Button to quit
        button_width = 200
        button_height = 50
        button_x = (SCREEN_WIDTH - button_width) // 2
        button_y = SCREEN_HEIGHT - 150
        self.quit_button_rect = pygame.Rect(button_x, button_y, button_width, button_height)

    def handle_input(self, event):
        if event.type == pygame.MOUSEBUTTONDOWN:
            if event.button == 1: # Left click
                if self.quit_button_rect.collidepoint(event.pos):
                    pygame.event.post(pygame.event.Event(pygame.QUIT)) # Post quit event

    def render(self, screen):
        # Title
        title_surf = self.font_title.render("Congratulations!", True, (0, 150, 0))
        title_rect = title_surf.get_rect(center=(SCREEN_WIDTH // 2, 150))
        screen.blit(title_surf, title_rect)

        # Info Text
        info_text = f"You reached ${WIN_CONDITION_CASH:,.0f} and became a Property Tycoon!"
        info_surf = self.font_info.render(info_text, True, (0, 0, 0))
        info_rect = info_surf.get_rect(center=(SCREEN_WIDTH // 2, 250))
        screen.blit(info_surf, info_rect)

        final_cash_text = f"Final Cash: ${self.game_state.player.cash:,.0f}"
        final_cash_surf = self.font_info.render(final_cash_text, True, (50, 50, 50))
        final_cash_rect = final_cash_surf.get_rect(center=(SCREEN_WIDTH // 2, 300))
        screen.blit(final_cash_surf, final_cash_rect)

        # Quit Button
        pygame.draw.rect(screen, (180, 180, 180), self.quit_button_rect)
        pygame.draw.rect(screen, (0, 0, 0), self.quit_button_rect, 2)
        quit_text_surf = self.font_button.render("Quit Game", True, (0, 0, 0))
        quit_text_rect = quit_text_surf.get_rect(center=self.quit_button_rect.center)
        screen.blit(quit_text_surf, quit_text_rect)