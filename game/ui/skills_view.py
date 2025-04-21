# filepath: c:\Users\iphoe\OneDrive\Documents\GitHub\Property-Flipper-Game\game\ui\skills_view.py
import pygame
from ..constants import *

class SkillsView:
    def __init__(self, game_state):
        self.game_state = game_state
        self.player = game_state.player # Convenience reference
        self.font_title = pygame.font.SysFont(None, 52)
        self.font_skill_name = pygame.font.SysFont(None, 40)
        self.font_info = pygame.font.SysFont(None, 30)
        self.font_button = pygame.font.SysFont(None, 32)
        self.font_feedback = pygame.font.SysFont(None, 28)

        self.back_button_rect = pygame.Rect(20, SCREEN_HEIGHT - 60, 100, 40)
        self.upgrade_buttons = {} # Store rects mapped to skill names

        # Feedback message for upgrade success/failure
        self.feedback_message = ""
        self.feedback_timer = 0
        self.feedback_color = COLOR_SUCCESS

    def show_feedback(self, message, duration=2.0, error=False):
         self.feedback_message = message
         self.feedback_timer = duration
         self.feedback_color = COLOR_ERROR if error else COLOR_SUCCESS

    def update(self, dt):
         if self.feedback_timer > 0:
             self.feedback_timer -= dt
             if self.feedback_timer <= 0:
                 self.feedback_message = ""

    def handle_input(self, event):
        if event.type == pygame.MOUSEBUTTONDOWN:
            if event.button == 1: # Left click
                # Check Back button
                if self.back_button_rect.collidepoint(event.pos):
                    self.game_state.current_view = "main_menu"
                    self.feedback_message = "" # Clear feedback on exit
                    return

                # Check Upgrade buttons
                for skill_name, rect in self.upgrade_buttons.items():
                    if rect.collidepoint(event.pos):
                        success = self.player.upgrade_skill(skill_name)
                        if success:
                            self.show_feedback(f"Upgraded {skill_name.capitalize()}!")
                        else:
                            # Check if max level or insufficient funds
                            if self.player.skills.get(skill_name, 0) >= MAX_SKILL_LEVEL:
                                self.show_feedback(f"{skill_name.capitalize()} at Max Level!", error=True)
                            else:
                                cost = self.player.get_skill_upgrade_cost(skill_name)
                                self.show_feedback(f"Need ${cost:,.0f} to upgrade!", error=True)
                        return # Processed click

    def render(self, screen):
        self.upgrade_buttons.clear() # Clear buttons each frame

        # Title
        title_surf = self.font_title.render("Player Skills", True, COLOR_TEXT)
        title_rect = title_surf.get_rect(center=(SCREEN_WIDTH // 2, 50))
        screen.blit(title_surf, title_rect)

        # Cash Display
        cash_text = f"Cash: ${self.player.cash:,.0f}"
        cash_surf = self.font_info.render(cash_text, True, COLOR_TEXT)
        screen.blit(cash_surf, (20, 80))

        # Back Button
        pygame.draw.rect(screen, COLOR_BUTTON, self.back_button_rect)
        pygame.draw.rect(screen, COLOR_BUTTON_BORDER, self.back_button_rect, 2)
        back_text_surf = self.font_button.render("Back", True, COLOR_BUTTON_TEXT)
        back_text_rect = back_text_surf.get_rect(center=self.back_button_rect.center)
        screen.blit(back_text_surf, back_text_rect)

        # --- Skill Display Area ---
        start_y = 130
        skill_spacing = 120
        current_y = start_y
        skill_box_width = SCREEN_WIDTH - 80
        skill_box_x = 40

        # Define skill order and descriptions
        skill_details = {
            "negotiation": {
                "name": "Negotiation",
                "desc": lambda p: f"Effect: {p.get_negotiation_bonus() * 100:.1f}% better buy/sell prices"
            },
            "handiness": {
                "name": "Handiness",
                "desc": lambda p: f"Effect: {(1.0 - p.get_handiness_cost_multiplier()) * 100:.0f}% cheaper & {(1.0 - p.get_handiness_speed_multiplier()) * 100:.0f}% faster renovations"
            },
            "marketing": { # <<< ADD MARKETING DETAILS
                "name": "Marketing",
                "desc": lambda p: f"Effect: +{p.get_marketing_bonus() * 100:.1f}% bonus on final sale price"
            }
        }
        # Ensure consistent order
        skill_order = ["negotiation", "handiness", "marketing"]

        for skill_name in skill_order:
            if skill_name not in self.player.skills: continue # Skip if skill somehow missing

            details = skill_details.get(skill_name)
            if not details: continue # Skip if details missing

            current_level = self.player.skills[skill_name]

            # Skill Name and Level
            name_text = f"{details['name']} (Level {current_level}/{MAX_SKILL_LEVEL})"
            name_surf = self.font_skill_name.render(name_text, True, COLOR_TEXT)
            screen.blit(name_surf, (skill_box_x + 10, current_y + 10))

            # Skill Description/Effect
            effect_text = details['desc'](self.player) # Call lambda to get description
            effect_surf = self.font_info.render(effect_text, True, COLOR_INFO)
            screen.blit(effect_surf, (skill_box_x + 10, current_y + 45))

            # Upgrade Button and Cost
            upgrade_cost = self.player.get_skill_upgrade_cost(skill_name)
            button_x = skill_box_x + skill_box_width - 160 # Position button on the right
            button_y = current_y + 65
            button_width = 150
            button_height = 35

            if current_level < MAX_SKILL_LEVEL:
                upgrade_rect = pygame.Rect(button_x, button_y, button_width, button_height)
                self.upgrade_buttons[skill_name] = upgrade_rect

                # Determine button color based on affordability
                can_afford = self.player.cash >= upgrade_cost
                button_color = (0, 180, 0) if can_afford else (150, 0, 0) # Green if affordable, Red if not

                pygame.draw.rect(screen, button_color, upgrade_rect)
                pygame.draw.rect(screen, COLOR_BUTTON_BORDER, upgrade_rect, 2)

                cost_text = f"Upgrade (${upgrade_cost:,.0f})"
                cost_surf = self.font_button.render(cost_text, True, (255, 255, 255))
                cost_rect = cost_surf.get_rect(center=upgrade_rect.center)
                screen.blit(cost_surf, cost_rect)
            else:
                # Display "Max Level" instead of button
                max_surf = self.font_button.render("Max Level", True, COLOR_INFO)
                max_rect = max_surf.get_rect(center=(button_x + button_width / 2, button_y + button_height / 2))
                screen.blit(max_surf, max_rect)

            current_y += skill_spacing

        # Render Feedback Message
        if self.feedback_message:
            feedback_surf = self.font_feedback.render(self.feedback_message, True, self.feedback_color)
            feedback_rect = feedback_surf.get_rect(center=(SCREEN_WIDTH // 2, SCREEN_HEIGHT - 30))
            screen.blit(feedback_surf, feedback_rect)