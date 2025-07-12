-- Reset subscriber subscription for testing
UPDATE subscribers 
SET subscribed = false, 
    subscription_tier = NULL, 
    subscription_end = NULL, 
    stripe_customer_id = NULL 
WHERE email = 'joaolages03+provider@gmail.com';