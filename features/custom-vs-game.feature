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

  Scenario: All players are scored against the same scale
    Given a VS game in a custom area whose scale is 200 km
    When one player guesses 10 km away and another guesses 60 km away
    Then the first scores 4190 points
    And the second scores 962 points

  Scenario: Guests cannot guess outside the area
    Given a VS game with a custom area is in progress
    When a guest taps outside the play area
    Then no pin is placed

  Scenario: Refreshing mid-game keeps the area for a guest
    Given a guest is playing a VS game in a custom area
    When the guest's session is restored after a refresh
    Then the guest rejoins with the same play area

  Scenario: Refreshing mid-game keeps the area for the host
    Given a host is running a VS game in a custom area
    When the host's session is restored after a refresh
    Then the host's play area is the one from before the refresh

  Scenario: A rapid double-click on Next does not create two rooms
    Given the host has chosen VS mode with a custom area
    When the host clicks Next twice in immediate succession
    And the host confirms the area
    Then only one room was ever created

  Scenario: Co-op games support a custom area the same way
    Given a Co-op game in a custom area whose scale is 200 km
    When one player guesses 10 km away and another guesses 60 km away
    Then everyone is awarded the best score of 4190 points
