Feature: Playing a solo game in a custom area

  Scenario: A whole game stays inside the chosen area
    Given the player has drawn an area around Greater Manchester
    And has chosen 3 rounds
    When the player plays all 3 rounds
    Then every location was inside the area
    And every guess was inside the area
    And each round's score matches the area's own scale, proving it was actually used
    And the game ends on the results screen

  Scenario: Scores use the custom area's scale
    Given the player has drawn an area whose scale is 40 km
    When the player guesses 4 km from the location
    Then they score 3430 points

  Scenario: A guess more than 45% across the custom area scores nothing
    Given the player has drawn an area whose scale is 40 km
    When the player guesses 20 km from the location
    Then they score 0 points

  Scenario: Running out of time scores nothing
    Given a custom game is in progress with a 30 second limit
    When the player lets the timer run out without guessing
    Then they score 0 points
    And the game moves to the next round

  Scenario: The speed bonus still applies
    Given a custom game with a 20 percent speed bonus and a 60 second limit
    When the player guesses 4 km from the location after 15 seconds
    Then their base score is 3430
    And their speed bonus is 514

  Scenario: The results screen explains the area
    Given the player has finished a custom game
    Then the results show the area's size and the distance beyond which a guess scores nothing

  Scenario: Playing again keeps the same area
    Given the player has finished a custom game
    When the player chooses play again
    Then the same area is used
