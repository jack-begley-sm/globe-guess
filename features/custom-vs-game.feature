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

  Scenario: A guest joining receives the area
    Given a host has created a VS room with a custom area
    When a guest joins the room
    Then the guest's play area matches the host's

  Scenario: A guest in the lobby already knows the area
    Given a host has created a VS room with a custom area
    And a guest has joined but the game has not started
    Then the guest's play area matches the host's

  Scenario: A guest joining mid-game receives the area
    Given a VS game with a custom area is in progress
    When a guest joins the room
    Then the guest's play area matches the host's
