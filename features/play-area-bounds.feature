Feature: A play area has a definite inside and outside

  Scenario: A location inside the drawn area counts
    Given a play area drawn around the box from 50N,-8W to 58N,2E
    When the point 54N,-3W is tested
    Then it is inside the play area

  Scenario: A location outside the drawn area does not count
    Given a play area drawn around the box from 50N,-8W to 58N,2E
    When the point 48N,10E is tested
    Then it is outside the play area

  Scenario: An area drawn across the date line stays in one piece
    Given a play area drawn around the box from 10S,170E to 10N,170W
    When the point 0N,179E is tested
    Then it is inside the play area
    And the point 0N,150E is outside the play area

  Scenario: A point exactly on the edge counts as inside
    Given a play area drawn around the box from 50N,-8W to 58N,2E
    When the point 50N,-3W is tested
    Then it is inside the play area

  Scenario: An area that crosses over itself is not a valid play area
    Given the player has drawn the ring 0N0E, 10N10E, 0N10E, 10N0E
    Then the ring is rejected as self-crossing
