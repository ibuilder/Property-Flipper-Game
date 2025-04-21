# filepath: c:\Users\iphoe\OneDrive\Documents\GitHub\Property-Flipper-Game\game\ui\help_view.py
import pygame
from ..constants import *
from ..utils.text_wrap import draw_text # Assuming you have or create a text wrapping utility

class HelpView:
    def __init__(self, game_state):
        self.game_state = game_state
        self.font_title = pygame.font.SysFont(None, 52)
        self.font_text = pygame.font.SysFont(None, 30)
        self.font_button = pygame.font.SysFont(None, 32)

        self.back_button_rect = pygame.Rect(SCREEN_WIDTH // 2 - 50, SCREEN_HEIGHT - 60, 100, 40)

        # Basic help text content
        self.help_text = [
            "Welcome to Property Flipper!",
            "",
            "Goal: Reach the target cash amount ($" + f"{WIN_CONDITION_CASH:,.0f}) to win.",
            "Lose Condition: Go bankrupt (negative cash with no properties to sell).",
            "",
            "Gameplay:",
            "- Use the 'Property Market' to buy houses.",
            "- View your owned properties in the 'Portfolio'.",
            "- Renovate properties using 'Upgrades' to increase their value.",
            "- Sell properties for a profit.",
            "- Manage your finances: Take loans, but beware of daily interest.",
            "- Pay daily property taxes based on property value.",
            "- Hire/Fire Crew to speed up renovations (at a daily cost).",
            "- Upgrade your 'Player Skills' to improve negotiation, handiness, and marketing.",
            "- Watch out for 'Market Events' that affect prices and costs.",
            "- Advance time using the 'Next Day' button.",
            "",
            "Good luck flipping!"
        ]

    def handle_input(self, event):
        if event.type == pygame.MOUSEBUTTONDOWN:
            if event.button == 1: # Left click
                if self.back_button_rect.collidepoint(event.pos):
                    sound_manager.play("click")
                    self.game_state.current_view = "main_menu"
                    return

    def render(self, screen):
        # Title
        title_surf = self.font_title.render("How to Play", True, COLOR_TEXT)
        title_rect = title_surf.get_rect(center=(SCREEN_WIDTH // 2, 50))
        screen.blit(title_surf, title_rect)

        # Back Button
        pygame.draw.rect(screen, COLOR_BUTTON, self.back_button_rect)
        pygame.draw.rect(screen, COLOR_BUTTON_BORDER, self.back_button_rect, 2)
        back_text_surf = self.font_button.render("Back", True, COLOR_BUTTON_TEXT)
        back_text_rect = back_text_surf.get_rect(center=self.back_button_rect.center)
        screen.blit(back_text_surf, back_text_rect)

        # Help Text Area
        text_area_rect = pygame.Rect(40, 100, SCREEN_WIDTH - 80, SCREEN_HEIGHT - 180)
        # pygame.draw.rect(screen, (240, 240, 240), text_area_rect) # Optional background

        current_y = text_area_rect.top + 10
        for line in self.help_text:
            # Use text wrapping utility here if available
            # For simplicity now, just render line by line
            if line:
                text_surf = self.font_text.render(line, True, COLOR_TEXT)
                screen.blit(text_surf, (text_area_rect.left + 10, current_y))
                current_y += self.font_text.get_linesize() # Move down by font height
            else:
                current_y += self.font_text.get_linesize() // 2 # Smaller gap for empty lines

            # Basic check to prevent drawing off-screen (needs proper scrolling for long text)
            if current_y > text_area_rect.bottom - self.font_text.get_linesize():
                break

    def update(self, dt):
        # No dynamic updates needed for this simple view
        pass

# --- Placeholder for Text Wrapping Utility ---
# You might need a utility like this if text gets long
# (Create game/utils/text_wrap.py if needed)
# Example structure:
# def draw_text(surface, text, color, rect, font, aa=False, bkg=None):
#     # ... implementation to wrap text within the rect ...
#     pass