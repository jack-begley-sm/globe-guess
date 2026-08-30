Feature: A custom area in a VS game

  Scenario: The host draws the area before the room is created
    Given the host has chosen VS mode with a custom area
    When the host confirms the area
    Then the room code is created
    And the share screen is shown

  Scenario: Playing again keeps the area
    Given a VS game in a custom area has finished
    When the host chooses play again
    Then the same area is used
    And the room code is unchanged
